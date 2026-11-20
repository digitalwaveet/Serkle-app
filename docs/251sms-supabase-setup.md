# 251SMS + Supabase Auth setup

Serkle uses a Supabase **Send SMS Hook**. Supabase remains responsible for
creating, expiring and verifying OTPs. The `send-sms` Edge Function verifies the
signed hook request and delivers the code through 251SMS.

## Files to deploy

- `supabase/functions/send-sms/index.ts`
- `supabase/functions/_shared/sms251.ts`
- `supabase/config.toml`

No database migration or service-role key is required for this integration.

## 1. Configure server-only secrets

In 251SMS, create or select an API token and confirm the approved sender ID.
Store both directly as Supabase Edge Function secrets; do not put them in
Vercel or any `VITE_*` variable:

```powershell
supabase secrets set SMS251_API_TOKEN="YOUR_251SMS_API_TOKEN"
supabase secrets set SMS251_SENDER_ID="YOUR_APPROVED_SENDER_ID"
```

The sender ID must be at most 11 characters, matching the 251SMS API contract.

## 2. Deploy the Edge Function

```powershell
supabase functions deploy send-sms --no-verify-jwt
```

The function URL is:

`https://fkeyentcklsuqecqgmak.supabase.co/functions/v1/send-sms`

`verify_jwt` is disabled because Supabase Auth does not call the hook with an
end-user JWT. The function instead verifies the Standard Webhooks signature.

## 3. Register the Supabase Auth hook

In Supabase Dashboard:

1. Open **Authentication → Hooks**.
2. Add or enable **Send SMS Hook**.
3. Select **HTTP** and enter the function URL above.
4. Copy the generated hook secret and store it as an Edge Function secret:

```powershell
supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_YOUR_GENERATED_HOOK_SECRET"
```

Never send the hook secret, API token or OTP through chat.

## 4. Enable phone authentication

In **Authentication → Sign In / Providers → Phone**, enable phone signups and
phone confirmations. The frontend already supplies phone identities in E.164
format and verifies codes through `supabase.auth.verifyOtp`.

The function converts Ethiopian E.164 numbers such as `+251911223366` to the
local `0911223366` format used by the 251SMS documentation. Other international
numbers are sent as country-code digits without a leading plus.

## 5. Production safeguards

- Keep the resend cooldown at 60 seconds or longer.
- Configure Supabase Auth SMS rate limits and CAPTCHA before live traffic.
- Use Supabase test phone numbers for automated/staging tests to avoid paid SMS.
- Monitor both Supabase Auth hook logs and the 251SMS message report.
- Never log OTP values or complete phone numbers.
- If the provider rejects a request, Serkle reports failure and does not imply
  that the code was delivered.

## Verification checklist

- A new phone signup receives one Serkle-branded OTP through 251SMS.
- A valid code verifies successfully in `/verify-account`.
- Wrong and expired codes are rejected by Supabase.
- Resend is disabled during the cooldown and sends only one new request.
- Invalid hook signatures return `401` without calling 251SMS.
- Missing provider configuration returns a clear failure without exposing a
  credential or OTP.
