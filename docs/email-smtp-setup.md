# Serkle SMTP mailer deployment

Serkle uses Supabase Edge Functions and the Little Tigers Group cPanel mailbox
to send authentication and notification emails. Supabase Auth continues to
create, expire and verify authentication codes. The mailer only renders and
delivers them.

## Architecture

- `send-email`: signed Supabase Auth **Send Email Hook** for signup, invite,
  magic-link, recovery and email-change messages.
- `send-notification-email`: server-to-server endpoint for allowlisted Serkle
  notification templates. It does not accept arbitrary HTML or subjects.
- `_shared/smtpMailer.ts`: authenticated TLS transport using Nodemailer.
- `_shared/serkleEmail.ts`: escaped, branded email templates.
- `notify-emergency-contacts`: now uses the same SMTP transport instead of
  Resend.

No SMTP credential is shipped to Vercel or the browser. No authentication OTP
or complete recipient address is logged.

## 1. Required Supabase secrets

Add these in **Supabase Dashboard → Edge Functions → Secrets**. Enter the real
mailbox password only in the dashboard; never paste it into chat or commit it.

```text
SMTP_HOSTNAME=mail.littletigersgroup.com
SMTP_PORT=465
SMTP_USERNAME=no-reply@littletigersgroup.com
SMTP_PASSWORD=<the cPanel mailbox password>
SMTP_FROM=no-reply@littletigersgroup.com
SMTP_FROM_NAME=Serkle
MAILER_INTERNAL_SECRET=<a new random server-to-server secret>
```

Port 465 uses implicit TLS. Certificate validation remains enabled. Do not
switch to port 587 because the hosted Supabase Edge runtime blocks outbound
connections to ports 25 and 587.

## 2. Deploy the functions

```powershell
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy send-notification-email --no-verify-jwt
supabase functions deploy notify-emergency-contacts
```

The Auth hook does not receive an end-user JWT; it verifies a Standard Webhooks
signature instead. The notification function requires
`Authorization: Bearer <MAILER_INTERNAL_SECRET>` and is server-to-server only.

## 3. Register the Send Email Auth Hook

In **Authentication → Hooks**:

1. Add or enable **Send Email Hook**.
2. Select **HTTP**.
3. Use:
   `https://fkeyentcklsuqecqgmak.supabase.co/functions/v1/send-email`
4. Copy the generated hook secret into the Edge Function secret named
   `SEND_EMAIL_HOOK_SECRET`.

Keep the Email provider enabled. When both the provider and hook are enabled,
Supabase delegates delivery to the hook. Do not configure a second Auth SMTP
delivery path at the same time.

## 4. cPanel domain authentication

In cPanel **Email Deliverability**, verify that `littletigersgroup.com` has
valid SPF and DKIM records. Add a DMARC policy if one is not already present.
These DNS records are essential for Gmail, Outlook and Yahoo delivery.

## 5. Notification endpoint contract

Only trusted backend jobs may invoke `send-notification-email`. Required JSON:

```json
{
  "eventId": "a-unique-event-id",
  "to": "recipient@example.com",
  "template": "general",
  "data": {
    "title": "Notification title",
    "message": "Notification text",
    "actionUrl": "https://serkle-app-five.vercel.app/notifications",
    "actionLabel": "View notification"
  }
}
```

Supported templates are `welcome`, `security_alert`, `payment_receipt`,
`circle_invitation`, `sos_alert` and `general`. Each event ID produces a stable
SMTP Message-ID to reduce duplicates during safe retries.

## Verification checklist

- Signup receives one branded six-digit verification email.
- Recovery receives the reset-password template and Supabase validates the OTP.
- Secure email change sends the correct separate codes to current and new
  addresses.
- Invalid hook signatures cannot send email.
- The notification endpoint rejects calls without the internal secret.
- Emergency-contact email reports distinguish sent and failed deliveries.
- SMTP failures do not falsely report success.
- No mailbox password, OTP or recipient email appears in application logs.
