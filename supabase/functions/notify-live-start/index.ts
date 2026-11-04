import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyLiveStartRequest {
  streamId: string;
  title: string;
  type: 'random' | 'circle';
  circleId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { streamId, title, type, circleId }: NotifyLiveStartRequest = await req.json();

    console.log('Sending live start notifications:', { streamId, title, type, circleId });

    // Get stream creator info
    const { data: stream, error: streamError } = await supabase
      .from('live_streams')
      .select('id,user_id,circle_id')
      .eq('id', streamId)
      .maybeSingle();

    if (streamError) {
      console.error('Error fetching stream:', streamError);
      throw streamError;
    }

    if (!stream) {
      console.error('Stream not found for ID:', streamId);
      return new Response(
        JSON.stringify({ error: 'Stream not found', streamId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name,username')
      .eq('id', stream.user_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    const streamerName = profile?.name || profile?.username || 'Someone';

    // Determine who to notify based on type
    let targetUserIds: string[] = [];

    if (type === 'circle' && circleId) {
      // Notify circle members
      console.log('Fetching circle members for:', circleId);
      const { data: members, error: membersError } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circleId)
        .eq('status', 'active')
        .neq('user_id', stream.user_id);

      if (membersError) {
        console.error('Error fetching members:', membersError);
      }
      
      targetUserIds = members?.map(m => m.user_id) || [];
      console.log('Found circle members:', targetUserIds.length);
    } else {
      // Notify followers for random live
      console.log('Fetching followers for user:', stream.user_id);
      const { data: followers, error: followersError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', stream.user_id);

      if (followersError) {
        console.error('Error fetching followers:', followersError);
      }

      targetUserIds = followers?.map(f => f.follower_id) || [];
      console.log('Found followers:', targetUserIds.length);
    }

    console.log(`Notifying ${targetUserIds.length} users`);

    // Create notifications
    const notifications = targetUserIds.map(userId => ({
      user_id: userId,
      notification_type: 'live_start',
      title: `${streamerName} is live!`,
      body: title,
      data: {
        stream_id: streamId,
        type: type
      }
    }));

    if (notifications.length > 0) {
      console.log('Inserting notifications:', notifications.length);
      const { error: notifError } = await supabase
        .from('push_notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Error creating notifications:', notifError);
        console.error('Notification error details:', JSON.stringify(notifError, null, 2));
        // Don't throw, just log - notifications are not critical
      } else {
        console.log('Notifications created successfully');
      }
    } else {
      console.log('No users to notify');
    }

    return new Response(
      JSON.stringify({ success: true, notified: notifications.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-live-start:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    console.error('Error stack:', errorStack);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
