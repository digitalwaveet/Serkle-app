import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action, content_type, content_id, content_text, user_id, batch } = await req.json();

    // Support single or batch moderation
    const items = batch || [{ content_type, content_id, content_text, user_id }];

    const results = [];

    for (const item of items) {
      if (!item.content_text || item.content_text.trim().length === 0) {
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
            { role: "user", content: item.content_text }
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
        const errText = await response.text();
        console.error("AI error:", response.status, errText);
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
        modResult = { spam_score: 0, hate_score: 0, nsfw_score: 0, overall_risk: "low", reasoning: "Parse error" };
      }

      // Determine auto-action based on rules
      let autoAction = null;
      if (modResult.overall_risk === "critical") autoAction = "removed";
      else if (modResult.overall_risk === "high") autoAction = "hidden";
      else if (modResult.overall_risk === "medium") autoAction = "flagged";

      // Store result
      const { data: insertData, error: insertError } = await supabase
        .from("ai_moderation_results")
        .insert({
          content_type: item.content_type,
          content_id: item.content_id,
          content_text: item.content_text.substring(0, 1000),
          user_id: item.user_id,
          spam_score: modResult.spam_score,
          hate_score: modResult.hate_score,
          nsfw_score: modResult.nsfw_score,
          overall_risk: modResult.overall_risk,
          ai_reasoning: modResult.reasoning,
          auto_action: autoAction,
        })
        .select()
        .single();

      if (insertError) {
        console.error("DB insert error:", insertError);
      }

      // Apply auto-action to content
      if (autoAction && (autoAction === "hidden" || autoAction === "removed")) {
        if (item.content_type === "post") {
          await supabase.from("posts").update({ moderation_status: autoAction }).eq("id", item.content_id);
        }
      }

      results.push({
        content_id: item.content_id,
        ...modResult,
        auto_action: autoAction,
        moderation_id: insertData?.id,
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
