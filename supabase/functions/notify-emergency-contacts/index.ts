import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildNotificationEmail, isEmailAddress } from "../_shared/serkleEmail.ts";
import { deterministicMessageId, sendSmtpMail } from "../_shared/smtpMailer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  alert_id: string;
  sos_type: string;
  urgency: string;
  description: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { alert_id, sos_type, urgency, description, location_lat, location_lng, location_address }: NotificationRequest = await req.json();

    // Get the user who created the alert
    const { data: alert, error: alertError } = await supabase
      .from('sos_alerts')
      .select('user_id')
      .eq('id', alert_id)
      .single();

    if (alertError || !alert) {
      throw new Error('Alert not found');
    }

    // Get user profile separately
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', alert.user_id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    }

    // Get emergency contacts for the user
    const { data: contacts, error: contactsError } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', alert.user_id);

    if (contactsError) {
      throw new Error('Failed to fetch emergency contacts');
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No emergency contacts to notify' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = profile?.name || 'Someone';
    const hasCoordinates = Number.isFinite(location_lat) && Number.isFinite(location_lng);
    const locationInfo = location_address || (hasCoordinates ? `${location_lat}, ${location_lng}` : 'Location not provided');
    const emailContacts = contacts.filter((contact) => isEmailAddress(contact.contact_phone));
    const notification = buildNotificationEmail('sos_alert', {
      name: userName,
      alertType: sos_type.toUpperCase(),
      urgency: urgency.toUpperCase(),
      description,
      location: locationInfo,
      mapUrl: hasCoordinates ? `https://www.google.com/maps?q=${location_lat},${location_lng}` : '',
    });

    const deliveries = await Promise.allSettled(
      emailContacts.map(async (contact, index) => sendSmtpMail({
        ...notification,
        to: contact.contact_phone,
        messageId: await deterministicMessageId('serkle-sos', `${alert_id}:${index}`),
      })),
    );
    const emailsSent = deliveries.filter((delivery) => delivery.status === 'fulfilled').length;
    const emailsFailed = deliveries.length - emailsSent;

    console.log('Emergency email notification attempt completed.', {
      alertId: alert_id,
      emailsSent,
      emailsFailed,
    });

    if (emailContacts.length > 0 && emailsSent === 0) {
      return new Response(
        JSON.stringify({ error: 'Emergency email delivery failed', emails_sent: 0, emails_failed: emailsFailed }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ 
        message: emailContacts.length > 0 ? 'Emergency email notifications processed' : 'No email emergency contacts to notify',
        email_contacts: emailContacts.length,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-emergency-contacts function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
