import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { alertId, alertType, urgency, description } = await req.json();

    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id');

    if (profilesError) throw profilesError;

    // Inserting the rows is all it takes: the on_push_notification_created
    // trigger delivers device push for each one.
    const notifications = (profiles || []).map((profile) => ({
      user_id: profile.id,
      notification_type: 'sos_alert',
      title: `New ${urgency} ${alertType} Alert`,
      body: (description || '').substring(0, 100),
      data: { alert_id: alertId },
    }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('push_notifications')
        .insert(notifications);
      if (insertError) throw insertError;
    }

    console.log(`Queued ${notifications.length} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: notifications.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
