# Serkle authentication deployment

The application now supports verified email/password and phone/password signup,
email and SMS account codes, resend cooldowns, and email or phone password
recovery. Supabase Auth sends and validates every code; Serkle never stores OTPs
or passwords.

## 1. URL configuration

In Supabase Dashboard → Authentication → URL Configuration, set:

- Site URL: `https://serkle-app-five.vercel.app`
- Redirect URLs:
  - `https://serkle-app-five.vercel.app/verify-account`
  - `https://serkle-app-five.vercel.app/reset-password`
  - `http://localhost:8082/verify-account`
  - `http://localhost:8082/reset-password`

If the production domain changes, add the new domain before deployment. The app
uses `window.location.origin`, so no domain is hardcoded in the authentication
components.

## 2. Email confirmation

In Authentication → Sign In / Providers → Email:

1. Keep email/password signup enabled.
2. Enable **Confirm email**.
3. Enable Custom SMTP in Authentication → Emails using Resend and
   `no-reply@serkle.app`. Follow [the SMTP setup guide](email-smtp-setup.md).
4. Keep the Send Email Auth Hook disabled so Supabase Auth sends directly via
   Custom SMTP. Supabase Auth issues, expires and validates the codes.

Enter the authentication SMTP credentials in the Supabase Auth SMTP settings.
Keep credentials out of Vercel client environment variables and source control.

### Confirm signup template

Authentication → Email Templates → Confirm signup:

```html
<h2>Verify your Serkle account</h2>
<p>Enter this six-digit code in Serkle:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 8px;">{{ .Token }}</p>
<p>This code expires shortly. If you did not create this account, ignore this email.</p>
```

### Reset password template

Authentication → Email Templates → Reset password:

```html
<h2>Reset your Serkle password</h2>
<p>Enter this six-digit recovery code in Serkle:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 8px;">{{ .Token }}</p>
<p>Or open the secure recovery page:</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>If you did not request this, ignore this email.</p>
```

Disable link tracking in the SMTP provider because tracking systems can rewrite
or pre-open authentication links.

## 3. Phone authentication and AfroMessage

In Authentication → Sign In / Providers → Phone:

1. Enable phone/password signup.
2. Enable phone confirmations.
3. Deploy the `send-sms` Edge Function and configure it as the Supabase Auth
   **Send SMS Hook**. Follow `docs/afromessage-supabase-setup.md`.
4. Supabase generates and verifies the code. The hook sends that code through
   AfroMessage's `/api/send` endpoint without generating a second OTP.

AfroMessage and hook credentials belong only in Supabase Edge Function secrets.
Never paste them into chat, commit them to Git, or expose them through `VITE_*`
variables.

## 4. Abuse protection

Before enabling live SMS:

- Enable Cloudflare Turnstile or hCaptcha in Supabase Auth.
- Add the corresponding frontend site key and captcha component in a separate
  deployment step.
- Keep the resend cooldown at 60 seconds or longer.
- Review SMS, email and verification rate limits.
- Enable leaked-password protection and a minimum password length of at least 8.
- Add fixed test phone numbers and OTPs for staging rather than sending paid SMS
  during automated tests.

## 5. Database migration

Deploy:

`supabase/migrations/20261118120000_fix_phone_auth_profiles.sql`

It updates `handle_new_user()` so phone identities are stored in
`profiles.phone`, and repairs earlier phone-only profiles whose number was put in
`profiles.email`. It does not change user IDs or delete account data.

## 6. Verification checklist

- Email signup receives a six-digit email code.
- Phone signup receives a six-digit SMS code.
- Wrong and expired codes show an error and do not create an app session.
- Resend is unavailable for 60 seconds after each send.
- Unverified login attempts return to account verification.
- Email and phone recovery both require a verified code before password update.
- Login, signup and OAuth preserve the original `returnTo` destination.
- Email, phone and Google accounts each receive a valid `profiles` row.

