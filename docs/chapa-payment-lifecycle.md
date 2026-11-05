# Chapa payment and Circle access lifecycle

The existing product buys coins through Chapa v1 (1 whole ETB = 1 coin), then
requires an explicit Circle purchase at its displayed coin price. A top-up does
not silently buy or grant Circle content. `purchase_circle_access` atomically
debits the authenticated buyer, records the receipt and writes the subscription
or one-time entitlement. Approved coverage remains all premium posts, videos and
resources; events/services require their separate explicit purchases.

## Verification and persistence

`chapa-initialize` persists an opaque transaction reference, authenticated owner,
amount, currency and live/test environment before returning checkout. The
account-scoped initialization request ID survives uncertain network responses.
The same ID cannot be reused for another amount or environment. Checkout return
URLs must match `PAYMENT_RETURN_ORIGINS` and the existing `/verify` route.
The wallet initiation hook sends the shared `CHAPA_RETURN_URL`, fixed to
`https://serkle-app-five.vercel.app/verify`. It does not derive the callback from the
browser's current host, so local and alternate deployments use the same
approved callback.

`chapa-verify` verifies the caller's JWT and receipt ownership, queries Chapa v1
with the server secret and checks reference, amount, currency, environment and a
timezone-aware provider timestamp. Unknown or mismatched data grants nothing.
The transaction reference is never attached to an arbitrary latest ledger row;
the ledger uses the durable payment intent's UUID.
Unverified demo credits, direct wallet/ledger writes and negative-amount
withdrawal credits are blocked, so they cannot fund premium access.

`chapa-webhook` authenticates the unmodified HTTP body using a constant-time
HMAC-SHA256 check. It requires the payload-bound `x-chapa-signature` (or a custom
payload-bound `chapa-signature`), not the v1 legacy constant secret digest. It
requeries Chapa before applying any value. Payload hashes deduplicate deliveries;
row locks, unique provider references and terminal reversal state prevent double
credits across webhooks, manual verification, jobs and retries. Test payments are
recorded but never create real spendable coins or premium entitlements.

Pending/failed payments grant no coins. A verified live success credits once.
Full top-up refunds/reversals remove that funding once; stale successes cannot
restore it. If coins were already spent, the wallet records the resulting debt
and cannot fund additional purchases without sufficient balance. A refund of
wallet funding does not silently refund independent Circle purchases. Refund
those purchases through their existing authorized receipt-specific API. Partial
or unfamiliar provider states require operator reconciliation; no prorated
entitlement policy is invented.

Circle receipt refunds revoke the corresponding access immediately. Backend
access checks validate the nonrefunded receipt and matching paid ledger debit,
so a stale unlock row cannot bypass revocation. Unrefunded one-time purchases,
independent paid periods and approved legacy grants retain their existing rules.
Subscriptions expire by server time, renew only after explicit payment, and
cancel at the end of the paid term. Leaving a Circle does not cancel billing.

## Recovery

`chapa-reconcile` accepts either a verified account JWT (own receipts only) or a
dedicated scheduler secret. It retries due intents through the provider API and
repairs missing grants from real Circle receipts and their debit ledger. It never
starts a payment, grants from client messages or reactivates a refunded receipt.
App startup, login/account change, reconnect, focus and a visible one-minute poll
invoke this recovery without depending on localStorage. Query keys and pending
references are account-scoped. A fresh device restores access from PostgreSQL.
Late responses from a previous account cannot update the current account's
payment state. Browser storage is an optional retry aid, with an in-memory
fallback; it is never the source of an entitlement.

The scheduled job reconciles due payments even when every client is closed.
Pending/provider-error intents retry after one minute; completed receipts are
rechecked daily for missed reversals. Webhooks and explicit verification run
immediately. Protected media URLs already issued retain their existing maximum
60-second lifetime; downloaded files cannot be recalled.

Old unbound Chapa references from before this migration cannot safely be claimed
by a supplied reference alone. Existing wallet balances and legacy entitlements
are preserved. An operator must review the original provider receipt and bind
ownership before importing an unprocessed legacy payment; never assign it to
whichever account supplies a reference.
Compare historical `coin_topups` and `coin_transactions` as well, so an already
honored legacy receipt is not credited twice. Ambiguous legacy receipts stay in
manual review; authenticated unknown-reference webhooks are durably recorded for
that review without granting value.

## Deployment

To deploy using the Supabase Dashboard editor, run
`npm run build:chapa-deployment`. It produces single-file functions with no local
shared-module imports in `deployment/chapa-payment-fix`, plus deployment notes
and the matching SQL files. Create each function using its exact filename stem.
`chapa-reconcile` and `chapa-webhook` disable gateway JWT verification and enforce
their own authentication for POST. Browser OPTIONS is answered before loading
payment secrets, and configuration errors include the complete CORS headers.
The allowed checkout origin for the current Vercel deployment is
`https://serkle-app-five.vercel.app`.

If checkout returns `Invalid payment return URL`, check the browser request's
`returnUrl` against the Supabase Edge Function secret `PAYMENT_RETURN_ORIGINS`.
For this app the request is `https://serkle-app-five.vercel.app/verify` and the secret
must contain `https://serkle-app-five.vercel.app` (no path or trailing slash). Update
this server secret in Supabase; a frontend Git push cannot change it. Keep the
allowlist restricted to approved app origins. Wallet errors read the function's
JSON error response instead of replacing it with the SDK's generic HTTP error.

Deploy alongside the earlier Circle entitlement/membership/leave migrations and
the matching frontend:

1. Authenticate/link Supabase and inspect remote migration history. Apply
   `20261104140000_verified_chapa_payments.sql` after its existing dependencies.
2. Configure Edge secrets: `CHAPA_SECRET_KEY`, `CHAPA_MODE` (`live` or `test`),
   `CHAPA_WEBHOOK_SECRET`, `CHAPA_RECONCILE_SECRET`, `PAYMENT_RETURN_ORIGINS`
   (comma-separated app origins). Supabase supplies its URL/service-role key.
   Use separate random webhook/scheduler secrets; never put them in Vite variables.
3. Deploy `chapa-initialize`, `chapa-verify`, `chapa-webhook` and `chapa-reconcile`
   with this repository's function JWT settings. Webhook is public but requires
   its signature; reconciliation verifies the JWT or scheduler secret itself.
4. In Chapa, register the project's `/functions/v1/chapa-webhook` URL and matching
   webhook secret for v1 transaction success/failure/refund/reversal events.
5. In Supabase Vault, configure `chapa_project_url` and `chapa_reconcile_secret`.
   Apply `supabase/setup/chapa-reconciliation.sql` to schedule the minute job.
   Inspect Cron/pg_net failures and intents with persistent `last_error` values.

The four functions were manually deployed and checked on 2026-11-04. Each
returned HTTP 204 for browser preflight from `https://serkle-app.vercel.app`;
user endpoints rejected unauthenticated POSTs and the webhook rejected unsigned
POSTs. These checks confirm deployment and CORS, not successful fulfillment.
The allowed return origins, database migrations, provider webhook and scheduler
configuration still need to be verified with the project owner. No real Chapa
payment is initiated by these checks or by the tests.

Provider references: [Chapa v1 webhook verification](https://developer.chapa.co/integrations/webhooks),
[transaction verification](https://developer.chapa.co/integrations/verify-payments),
[refund states](https://developer.chapa.co/refund),
[Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).

## Tests

`npm run test:payments` exercises the actual SQL migrations and HTTP handler
factories against isolated PostgreSQL (PGlite) and a mocked provider. It covers
signature tampering, cross-account claims, amount/currency/mode mismatches,
concurrent callbacks, failures after credit, outages and missed webhooks, restart/
login/device restoration, refunds/reversals, expiry, renewal, receipt repair and
fake client success. Existing Circle integration tests retain product-rule
coverage for included content, excluded events/services and independent purchases.
The purchase endpoint also repairs the caller's paid grants transactionally
before evaluating another debit, preventing duplicate charges when a grant row
is missing during recovery.
