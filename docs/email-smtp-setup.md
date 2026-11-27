# Serkle SMTP mailer deployment

Serkle uses Supabase Auth Custom SMTP and the Little Tigers Group cPanel
mailbox for authentication email. Edge Functions continue to send application
notifications. Supabase Auth creates, expires, renders and verifies all
authentication codes.

## Architecture

- **Supabase Auth Custom SMTP** sends signup, invite, magic-link, recovery and
  email-change messages directly through the cPanel mailbox.
- `send-email`: legacy Auth worker. Keep its Auth hook disabled and retire its
  recurring job after verifying direct SMTP delivery with a fresh code.
- `send-notification-email`: server-to-server endpoint for allowlisted Serkle
  notification templates. It does not accept arbitrary HTML or subjects.
- `_shared/smtpMailer.ts`: authenticated TLS transport using Nodemailer.
- `_shared/serkleEmail.ts`: escaped, branded email templates.
- `notify-emergency-contacts`: now uses the same SMTP transport instead of
  Resend.

No SMTP credential is shipped to Vercel or the browser. No authentication OTP
or complete recipient address is logged.

## 1. Edge Function secrets for application notifications

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
```

Port 465 uses implicit TLS. Certificate validation remains enabled. Do not
switch to port 587 because the hosted Supabase Edge runtime blocks outbound
connections to ports 25 and 587.

These Edge Function settings are separate from the Auth SMTP settings below.

## 2. Deploy the functions

```powershell
supabase functions deploy send-notification-email --no-verify-jwt
supabase functions deploy notify-emergency-contacts
```

The notification function requires
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
Enabling the hook routes authentication email through the legacy Edge worker.
After confirming delivery of a freshly requested signup code, disable the
scheduled job that posts to `/functions/v1/send-email`. For a missing code
after a successful resend response, inspect Supabase Auth logs around that
request, then check cPanel Track Delivery for the recipient and send time.

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

## Optional cutover to Resend with automatic cPanel fallback

The Vercel integration provisions credentials for Vercel. Serkle Auth runs in
Supabase, so create a sending key scoped to the verified Resend domain and set
`RESEND_API_KEY` and `AUTH_EMAIL_RESEND_FROM=Serkle <no-reply@serkle.app>` in
Supabase Edge Function secrets. Keep the cPanel SMTP secrets above and add
`SEND_EMAIL_HOOK_SECRET` and a separate `AUTH_EMAIL_WORKER_SECRET`.

Apply `20261127143000_fix_auth_email_outbox_role.sql` after the outbox migration,
then deploy `send-email` with `--no-verify-jwt`. Verify that the protected
worker can connect and authenticate to cPanel on port 465 from the deployed
runtime before cutover. Configure a scheduled POST to the worker using
`x-email-worker-secret` for retries.

After both providers pass a controlled delivery test, enable the signed HTTPS
Send Email Hook pointing to `/functions/v1/send-email`. Supabase then uses the
hook for authentication email. Keep the direct cPanel settings available for
rollback by disabling the hook.

The worker uses SMTP when Resend explicitly rejects a request with HTTP 401,
403, or 429. It retries ambiguous errors using the same Resend idempotency key.
If Gmail accepts a message and places it in Spam, the worker receives no
send error to trigger failover. Compare the worker's provider message ID
with Resend's email log or cPanel Track Delivery.

## Verification checklist

- Signup receives one branded six-digit verification email.
- Recovery receives the reset-password template and Supabase validates the OTP.
- Secure email change sends the correct separate codes to current and new
  addresses.
- The Send Email Auth Hook is disabled.
- The notification endpoint rejects calls without the internal secret.
- Emergency-contact email reports distinguish sent and failed deliveries.
- SMTP failures do not falsely report success.
- No mailbox password, OTP or recipient email appears in application logs.
