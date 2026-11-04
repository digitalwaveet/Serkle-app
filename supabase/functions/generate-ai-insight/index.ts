import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnswerItem {
  id: string;
  answer: string;
  isExpert?: boolean;
  isHelpful?: boolean;
  authorName?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionId, question, category, answers } = await req.json();
    
    console.log(`Processing AI discussion summary for question ${questionId}, answer count: ${answers?.length || 0}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rule: Never fabricate consensus. If fewer than 2 answers, do not generate a speculative summary.
    if (!answers || !Array.isArray(answers) || answers.length < 2) {
      const emptySummary = {
        status: 'insufficient_discussion',
        message: 'There is not enough discussion to summarize yet.',
        answer_count_at_summary: answers ? answers.length : 0,
        generated_at: new Date().toISOString()
      };

      if (questionId) {
        await supabase
          .from('questions')
          .update({ ai_discussion_summary: emptySummary })
          .eq('id', questionId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'insufficient_discussion',
          summary: emptySummary 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const answersDigest = answers
      .map((a: AnswerItem, idx: number) => {
        const role = a.isExpert ? 'Verified Professional' : 'Community Member';
        return `[Answer ${idx + 1} by ${role}${a.isHelpful ? ' (Marked Helpful by Author)' : ''}]:\n${a.answer}`;
      })
      .join('\n\n');

    const prompt = `Question: "${question}"
Category: ${category || 'General'}

Below are the REAL answers provided by the community and verified professionals:
${answersDigest}

Summarize this discussion objectively based strictly on what the community and professionals said.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an objective, neutral discussion summarizer for the Serkle community.
Your role is NEVER to answer the question yourself or provide standalone advice.
Your role is to summarize what real human community members and verified professionals have shared.

STRICT CONSTRAINTS:
1. NEVER fabricate community consensus. If there is no clear consensus, say so.
2. DO NOT introduce new advice, facts, or recommendations not present in the provided answers.
3. Structure your response in valid JSON matching this exact schema:
{
  "summary_overview": "1-2 sentence neutral overview of the discussion",
  "most_suggest": ["Primary point or suggestion made by multiple members", "Another frequent suggestion"],
  "different_perspectives": ["Alternative view or nuance raised", "Caveat or warning mentioned by a member"],
  "expert_input": ["Key recommendation from verified professional(s)"] // null or empty array if no verified professionals participated
}
4. Return ONLY valid JSON, no markdown codeblocks or extra text.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error(`AI discussion summarization failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices[0].message.content.trim();
    
    // Parse structured JSON safely
    let parsedSummary;
    try {
      // Remove any markdown fence if present
      const cleanJson = rawContent.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
      parsedSummary = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn('Failed to parse strict JSON, building fallback structure:', parseErr);
      parsedSummary = {
        summary_overview: rawContent,
        most_suggest: [],
        different_perspectives: [],
        expert_input: null,
      };
    }

    const structuredSummary = {
      status: 'ready',
      summary_overview: parsedSummary.summary_overview || 'Discussion summary across community responses.',
      most_suggest: Array.isArray(parsedSummary.most_suggest) ? parsedSummary.most_suggest : [],
      different_perspectives: Array.isArray(parsedSummary.different_perspectives) ? parsedSummary.different_perspectives : [],
      expert_input: Array.isArray(parsedSummary.expert_input) && parsedSummary.expert_input.length > 0 ? parsedSummary.expert_input : null,
      answer_count_at_summary: answers.length,
      generated_at: new Date().toISOString()
    };

    console.log('Discussion summary generated successfully for question:', questionId);

    // Save structured discussion summary to the question
    if (questionId) {
      const { error: updateError } = await supabase
        .from('questions')
        .update({ 
          ai_discussion_summary: structuredSummary,
          // Clear legacy ai_response to prevent standalone AI answers
          ai_response: null
        })
        .eq('id', questionId);

      if (updateError) {
        console.error('Error updating question with ai_discussion_summary:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, summary: structuredSummary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-ai-insight (discussion summarizer):', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
