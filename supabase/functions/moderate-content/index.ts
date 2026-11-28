import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const token = /^Bearer (.+)$/i.exec(req.headers.get('authorization') || '')?.[1];
    if (!token) return json({ error: 'Authentication required' }, 401);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: 'Authentication required' }, 401);
    const { data: allowed, error: roleError } = await supabase.rpc('is_any_admin', { _user_id: user.id });
    if (roleError) return json({ error: 'Admin access could not be verified' }, 503);
    if (!allowed) return json({ error: 'Admin access required' }, 403);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ error: 'The moderation provider is not configured' }, 503);

    const body = await req.json().catch(() => null);
    const items = body?.batch ?? [body];
    if (!Array.isArray(items) || !items.length || items.length > 5 || items.some((item) => item?.content_type !== 'post'
      || typeof item.content_id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item.content_id))) {
      return json({ error: 'Supply one to five valid post references.' }, 400);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: posts, error: postError } = await userClient.from('posts').select('id,content').in('id', items.map((item) => item.content_id));
    if (postError) return json({ error: 'Could not load posts for this scan.' }, 503);

    const results = [];

    for (const item of items) {
      const content = posts?.find((post) => post.id === item.content_id)?.content;
      if (typeof content !== 'string' || !content.trim()) {
        results.push({ content_id: item.content_id, skipped: true });
        continue;
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You are a content moderation AI. Analyze the given text and return a JSON assessment. Score each category from 0.00 to 1.00:
- spam_score: likelihood of spam/promotional/irrelevant content
- hate_score: likelihood of hate speech, discrimination, harassment
- nsfw_score: likelihood of sexually explicit or violent content

Also provide:
- overall_risk: "low" (all scores < 0.3), "medium" (any score 0.3-0.6), "high" (any score 0.6-0.8), "critical" (any score > 0.8)
- reasoning: brief explanation (max 100 chars)

Return ONLY valid JSON, no markdown.`
            },
            { role: "user", content: content.slice(0, 12000) }
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_moderation",
              description: "Report content moderation results",
              parameters: {
                type: "object",
                properties: {
                  spam_score: { type: "number" },
                  hate_score: { type: "number" },
                  nsfw_score: { type: "number" },
                  overall_risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  reasoning: { type: "string" }
                },
                required: ["spam_score", "hate_score", "nsfw_score", "overall_risk", "reasoning"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "report_moderation" } }
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        console.error('AI moderation provider status:', response.status);
        results.push({ content_id: item.content_id, error: "AI analysis failed" });
        continue;
      }

      const aiData = await response.json();
      let modResult;

      try {
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          modResult = JSON.parse(toolCall.function.arguments);
        } else {
          // Fallback: try parsing content directly
          const content = aiData.choices?.[0]?.message?.content || "{}";
          modResult = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, ""));
        }
      } catch {
        results.push({ content_id: item.content_id, error: 'Moderation response could not be read' });
        continue;
      }

      const { data: resultId, error: saveError } = await supabase.rpc('record_admin_post_scan', {
        _actor: user.id, _post_id: item.content_id, _content: content,
        _spam: modResult?.spam_score, _hate: modResult?.hate_score, _nsfw: modResult?.nsfw_score,
        _risk: modResult?.overall_risk, _reason: typeof modResult?.reasoning === 'string' ? modResult.reasoning : '',
      });
      if (saveError || !resultId) {
        results.push({ content_id: item.content_id, error: 'Scan result could not be saved' });
        continue;
      }

      results.push({
        content_id: item.content_id,
        moderation_id: resultId,
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
