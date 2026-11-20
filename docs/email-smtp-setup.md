# Serkle SMTP mailer deployment

Serkle uses Supabase Auth Custom SMTP and the Little Tigers Group cPanel
mailbox for authentication email. Edge Functions continue to send application
notifications. Supabase Auth creates, expires, renders and verifies all
authentication codes.

## Architecture

- **Supabase Auth Custom SMTP** sends signup, invite, magic-link, recovery and
  email-change messages directly through the cPanel mailbox.
- `send-email`: retained as a disabled fallback worker and for recovery of any
  already queued Auth emails. Do not enable its Auth hook while Custom SMTP is
  active.
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
SMTP_HOSTNAME=pimms.hostns.io
SMTP_PORT=465
SMTP_USERNAME=no-reply@littletigersgroup.com
SMTP_PASSWORD=<the cPanel mailbox password>
SMTP_FROM=no-reply@littletigersgroup.com
SMTP_FROM_NAME=Serkle
MAILER_INTERNAL_SECRET=<a new random server-to-server secret>
AUTH_EMAIL_WORKER_SECRET=<a separate random worker secret>
```

Port 465 uses implicit TLS. Certificate validation remains enabled. Do not
switch to port 587 because the hosted Supabase Edge runtime blocks outbound
connections to ports 25 and 587.

Apply `20261120143000_auth_email_outbox.sql`. Schedule a protected POST to the
`send-email` function once per minute with `x-email-worker-secret`; the hook
also starts the worker immediately after a successful enqueue, while the
schedule recovers interrupted SMTP attempts.

## 2. Deploy the functions

```powershell
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy send-notification-email --no-verify-jwt
supabase functions deploy notify-emergency-contacts
```

The Auth hook does not receive an end-user JWT; it verifies a Standard Webhooks
signature instead. The notification function requires
`Authorization: Bearer <MAILER_INTERNAL_SECRET>` and is server-to-server only.

## 3. Configure Supabase Auth Custom SMTP

In **Authentication → Email → SMTP Settings**:

1. Enable **Custom SMTP**.
2. Sender email: `no-reply@littletigersgroup.com`.
3. Sender name: `Serkle`.
4. Host: `pimms.hostns.io`.
5. Port: `465`.
6. Username: `no-reply@littletigersgroup.com`.
7. Enter the mailbox password only in the Supabase Dashboard and save.

Keep the Email provider enabled and the **Send Email Auth Hook disabled**.
Enabling the hook replaces Custom SMTP delivery and will route messages back to
the legacy Edge worker.

Do not use `mail.littletigersgroup.com` until its DNS record is corrected. It
currently resolves to a web server where port 465 is closed. The hosting
provider's SMTP endpoint `pimms.hostns.io` resolves to the working mail server
and presents a certificate valid for that hostname.

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
