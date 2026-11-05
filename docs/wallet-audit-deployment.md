# Wallet audit: manual Supabase release

Project: `zewcewkqruxlniavsrgj`. App: `https://serkle-app-five.vercel.app`.
This is a coordinated database, Edge Function and frontend release. A Git push
deploys the frontend through Vercel; it does not deploy the Supabase changes.
These files contain no secrets. Keep all payment and service credentials on the
server. The tests use an isolated database and mocked Chapa, never real payouts.

## 1. Apply the database changes

Back up the database and inspect Supabase migration history first. Use SQL Editor
to run only unapplied migrations, in filename order, after the existing project
migrations. The package's `sql` folder includes the November Circle dependencies
and `20261104140000_verified_chapa_payments.sql` for projects missing them. Do not
rerun previously applied table-creation migrations.

For a project with the November 4 payment schema already installed, apply:

1. `20261105160000_wallet_payment_audit.sql`
2. `20261105161000_wallet_withdrawal_safety.sql`
3. `20261105162000_wallet_ledger_integrity.sql`
4. `20261105163000_wallet_tip_idempotency.sql`

Apply each entire migration as a transaction (wrap its contents in `BEGIN;` and
`COMMIT;` if your SQL Editor does not run the selection in one transaction).
The accounting migration briefly locks wallet tables to capture existing opening
balances. It preserves those balances and historical entries; it does not certify
old balances against provider records or invent historical events. Future balance
changes must have matching immutable ledger entries in the same transaction.
Client wallet writes, unbound withdrawal debits and the old unprotected tip
endpoint are rejected. Deploy the matching functions and frontend immediately.

## 2. Configure server secrets

In Supabase Edge Functions > Secrets, set:

| Secret | Value |
| --- | --- |
| `CHAPA_MODE` | `test` or `live`, the mode for new transactions |
| `CHAPA_SECRET_KEY` | Chapa key matching that active mode |
| `PAYMENT_RETURN_ORIGINS` | `https://serkle-app-five.vercel.app` |
| `CHAPA_WEBHOOK_SECRET` | Payload-signing secret registered with Chapa |
| `CHAPA_RECONCILE_SECRET` | Separate random secret for the scheduled job |
| `CHAPA_TEST_SECRET_KEY` | Optional test key for continued test-receipt checks |
| `CHAPA_LIVE_SECRET_KEY` | Optional live key for continued live-receipt checks |

Supabase supplies its URL and service-role key. Do not put these secrets in Vite
environment variables, browser storage, function source, Git or support receipts.
When switching the active mode, keep the other mode's dedicated key configured
if its historical receipts still need checks. Never use one environment's key
to verify another environment's receipt. The active `CHAPA_SECRET_KEY` remains
required even when the optional keys are present.

## 3. Deploy all five functions

Run `npm run build:chapa-deployment` in the repository to regenerate this package.
In Supabase Dashboard > Edge Functions, edit/create the exact names below. Replace
`index.ts` with the entire matching generated `.ts` file, then deploy.

| Function | Legacy JWT verification |
| --- | --- |
| `chapa-initialize` | ON |
| `chapa-verify` | ON |
| `chapa-transfer` | ON |
| `chapa-webhook` | OFF; handler verifies the raw-body Chapa signature |
| `chapa-reconcile` | OFF; handler verifies account JWT or scheduler secret |

OPTIONS returns 204 before payment configuration loads. An unsigned webhook or
an unauthenticated user request must not move funds. For withdrawals, the server
must verify the provider's destination fields as well as amount/reference. If the
provider cannot supply matching evidence, the receipt remains unresolved for
review; it is never automatically paid again or refunded from a client assertion.

## 4. Webhooks, scheduler and operations

Register `https://zewcewkqruxlniavsrgj.supabase.co/functions/v1/chapa-webhook` in
Chapa with the matching payload-signing secret. Subscribe to transaction and
payout status notifications, including failures, refunds and reversals. This
handler accepts payload-bound HMAC signatures; it intentionally rejects the old
constant secret digest. Webhook notifications trigger provider verification,
not direct wallet credit. Check any OTP/transfer approval settings in Chapa;
this release does not implement or bypass a separate transfer approval endpoint.

In Supabase Vault, configure `chapa_project_url` with the project's HTTPS URL and
`chapa_reconcile_secret` with the same value as Edge `CHAPA_RECONCILE_SECRET`.
Run `setup/chapa-reconciliation.sql` to schedule the minute job. Use
`setup/wallet-audit-operations.sql` for read-only health, overdue receipts, money
movement comparisons and legacy withdrawal review. Check Cron/pg_net failures
and actual completed run times; a configured cron entry alone is not proof that
checks ran. Arrange operator monitoring of overdue/review rows. Historical
transactions without a trustworthy owner binding require manual provider review;
never attach them to the last wallet row or whoever supplies a reference.

Manual recovery: Wallet > History > Payments > select receipt > Check payment
status. This verifies the existing reference and cannot start another checkout
or payout. Automatic checks continue when clients are closed if the scheduler
is healthy. Network/provider outages can delay settlement; the durable receipt
and audit trail remain available. A payout with uncertain submission is never
automatically resent. If it cannot be verified, an operator must reconcile with
Chapa before any authorized corrective transaction; do not edit ledger history,
blindly refund timeouts, or ask the customer to pay again.

## 5. Release checks

Deploy the matching frontend. In test mode, verify a top-up and a withdrawal:
both should have detailed test receipts and no change to the real coin balance.
Check reload/login history restoration, pending/error labels, receipt pagination
and manual status recovery. Confirm the scheduler records completed runs for
every configured mode. Test failed/duplicate callbacks with the automated mocked
suite; do not replay real charges for testing. No live payment or payout is
authorized merely by following these deployment checks.

Existing Shop coin checkout still needs a product decision on conversion from
its dollar totals and atomic order settlement; see the main lifecycle guide.
