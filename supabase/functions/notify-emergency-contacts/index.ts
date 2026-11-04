import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
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
    const locationInfo = location_address || (location_lat && location_lng ? `${location_lat}, ${location_lng}` : 'Location not provided');
    
    // Send email notifications using Resend
    if (RESEND_API_KEY) {
      const emailPromises = contacts
        .filter(contact => contact.contact_phone.includes('@')) // Basic email detection
        .map(async (contact) => {
          try {
            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: "SOS Alert <onboarding@resend.dev>",
                to: [contact.contact_phone],
                subject: `🚨 Emergency Alert from ${userName}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #dc2626;">🚨 Emergency Alert</h1>
                    <p><strong>${userName}</strong> has triggered an SOS alert and needs help.</p>
                    
                    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <h2 style="color: #991b1b; margin-top: 0;">Alert Details</h2>
                      <p><strong>Type:</strong> ${sos_type.toUpperCase()}</p>
                      <p><strong>Urgency:</strong> ${urgency.toUpperCase()}</p>
                      <p><strong>Description:</strong> ${description}</p>
                      <p><strong>Location:</strong> ${locationInfo}</p>
                    </div>
                    
                    ${location_lat && location_lng ? `
                      <p>
                        <a href="https://www.google.com/maps?q=${location_lat},${location_lng}" 
                           style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                          View Location on Map
                        </a>
                      </p>
                    ` : ''}
                    
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                      This is an automated emergency notification. Please try to contact ${userName} immediately.
                    </p>
                  </div>
                `,
              }),
            });

            if (!response.ok) {
              const error = await response.text();
              console.error(`Failed to send email to ${contact.contact_phone}:`, error);
            }
          } catch (error) {
            console.error(`Error sending email to ${contact.contact_phone}:`, error);
          }
        });

      await Promise.all(emailPromises);
    }

    // Log notification sent
    console.log(`Notified ${contacts.length} emergency contacts for alert ${alert_id}`);

    return new Response(
      JSON.stringify({ 
        message: 'Emergency contacts notified', 
        contacts_notified: contacts.length 
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
