import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  alert_id: string;
  sos_type: string;
  urgency: string;
  description: string;
  location_lat: number;
  location_lng: number;
  location_address?: string;
  max_distance_km?: number;
}

// Haversine formula to calculate distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if current time is within quiet hours
function isQuietHours(quietStart: string | null, quietEnd: string | null): boolean {
  if (!quietStart || !quietEnd) return false;
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = quietStart.split(':').map(Number);
  const [endHour, endMin] = quietEnd.split(':').map(Number);
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  if (startTime < endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Quiet hours cross midnight
    return currentTime >= startTime || currentTime <= endTime;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: NotificationRequest = await req.json();
    console.log('Notifying nearby users for alert:', payload.alert_id);

    const { location_lat, location_lng, max_distance_km = 10 } = payload;

    // Get all available helper profiles
    const { data: helpers, error: helpersError } = await supabase
      .from('helper_profiles')
      .select('user_id, is_available, last_known_lat, last_known_lng')
      .eq('is_available', true);

    if (helpersError) {
      console.error('Error fetching helpers:', helpersError);
      throw helpersError;
    }

    if (!helpers || helpers.length === 0) {
      console.log('No available helpers found');
      return new Response(
        JSON.stringify({ message: 'No available helpers to notify', notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get notification preferences for these helpers
    const helperIds = helpers.map(h => h.user_id);
    const { data: preferences, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, enabled, sos_alerts, max_distance_km, quiet_hours_start, quiet_hours_end')
      .in('user_id', helperIds);

    if (prefsError) {
      console.error('Error fetching notification preferences:', prefsError);
      // Continue without preferences rather than failing
    }

    // Create a map of preferences by user_id
    const prefsMap = new Map();
    if (preferences) {
      preferences.forEach(pref => {
        prefsMap.set(pref.user_id, pref);
      });
    }

    // Merge helpers with their preferences
    const helpersWithPrefs = helpers.map(helper => ({
      ...helper,
      notification_preferences: prefsMap.get(helper.user_id) || null,
    }));

    // Filter helpers by distance and preferences
    const eligibleHelpers = helpersWithPrefs.filter(helper => {
      // Check if helper has location
      if (!helper.last_known_lat || !helper.last_known_lng) {
        return false;
      }

      // Calculate distance
      const distance = calculateDistance(
        location_lat,
        location_lng,
        helper.last_known_lat,
        helper.last_known_lng
      );

      // Get notification preferences
      const prefs = helper.notification_preferences as any;
      if (!prefs || !prefs.enabled || !prefs.sos_alerts) {
        return false;
      }

      // Check distance preference
      const maxDistance = prefs.max_distance_km || 10;
      if (distance > maxDistance) {
        return false;
      }

      // Check quiet hours
      if (isQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) {
        // Only send critical alerts during quiet hours
        if (payload.urgency !== 'high') {
          return false;
        }
      }

      return true;
    });

    console.log(`Found ${eligibleHelpers.length} eligible helpers out of ${helpersWithPrefs.length} total`);

    if (eligibleHelpers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No eligible helpers within range', notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create notification records
    const notifications = eligibleHelpers.map(helper => ({
      user_id: helper.user_id,
      notification_type: 'new_alert',
      title: `🚨 ${payload.urgency.toUpperCase()} ${payload.sos_type} Alert Nearby`,
      body: payload.description.substring(0, 100),
      data: {
        alert_id: payload.alert_id,
        alert_type: payload.sos_type,
        urgency: payload.urgency,
        location_lat: location_lat,
        location_lng: location_lng,
        location_address: payload.location_address,
      },
    }));

    const { error: insertError } = await supabase
      .from('push_notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error storing notifications:', insertError);
      throw insertError;
    }

    console.log(`Successfully notified ${eligibleHelpers.length} nearby helpers`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notified ${eligibleHelpers.length} nearby helpers`,
        notified: eligibleHelpers.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-nearby-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
