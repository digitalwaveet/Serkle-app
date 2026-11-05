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
After creating the server intent, `chapa-initialize` adds its opaque reference
as `?tx_ref=...` to this callback. Client query parameters cannot select or
replace that reference. The return screen preserves the reference in its URL
even when a completed check clears the account's pending browser storage.

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
The UI shows `test_verified` as **Test payment successful**, with an explicit
no-spendable-coins explanation. It does not display a failure or live-credit
message for a successful test transaction.

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

For legacy bare `/verify` returns or missing browser storage, authenticated
`chapa-verify` can recover receipts from the current account and payment mode
created within the last 24 hours. One candidate is reverified with Chapa;
multiple candidates require an explicit selection. No candidates produce a
neutral verification-needed state, not a declined-payment claim. Explicit
references remain verifiable outside that recovery window, subject to ownership.
Already completed receipts remain recoverable after a webhook or background
reconciliation clears the pending browser reference.

The scheduled job reconciles due payments even when every client is closed.
Recent pending/failed intents retry after one minute; provider errors back off
from one to fifteen minutes. Older unresolved receipts and completed receipts
are checked daily. Each batch reserves capacity for settled receipts so pending
payments cannot indefinitely block missed-reversal checks. Webhooks and explicit verification run
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

## Wallet receipts, accounting and withdrawals

Wallet > History separates **Payments** (every persisted test/live top-up and
withdrawal attempt) from **Coin activity** (actual balance movements). Both use
timestamp/UUID cursor pagination, including records beyond 50. Receipts show
amount, currency, environment, merchant/provider references, method and fee when
provided, creation/verification/settlement times, masked withdrawal destination,
linked ledger IDs and balances after each movement. Times include the viewer's
timezone. Missing fields say they are unavailable. Test successes and pending
wallet fulfillment cannot look like credited live money. Account-bound read RPCs
derive ownership from Auth; callers cannot choose a different user ID.

An append-only audit timeline records initialization, provider checks and errors,
reserve/restore movements, submission starts and review flags. Only allowlisted
provider fields enter receipts: no secret keys, full bank account numbers, raw
provider bodies or webhook payloads. The history includes manual status checks
and automatic checks with their source. Existing receipts get a clearly marked
import snapshot; previously unrecorded events are not invented. Uncertain
checkout responses keep the durable reference and request ID. Concurrent check
leases and per-user check throttling prevent duplicate fulfillment/provider spam.

Live withdrawals atomically reserve coins and create a receipt before contacting
Chapa. A permanent submission marker is set before the single provider POST.
It means submission **started**, not proof the provider received or completed it.
Retries reuse the request and never automatically send that payout again after a
timeout or process crash. Verified transfer evidence must match the saved amount,
currency, reference, environment, timezone-aware timestamp and hashed bank/account
destination. Only a confirmed failure/reversal returns reserved coins, once.
A reservation abandoned before the submission marker can be safely returned
without contacting the provider. A completed payout followed by a generic failed
state, or success after funds were already returned, requires operator review;
the system neither pays again nor silently debits the user again. Test withdrawals
are recorded without reserving or returning real coins. Changing from test to
live requires the user to review the refreshed mode and confirm again.

Legacy opening balances are preserved in immutable accounting baselines. Every
later balance change must match an immutable journal entry in the same database
transaction; deferred constraints reject incomplete money mutations. Sequence
ordering prevents backdated journal timestamps bypassing this comparison. This
does not prove the correctness of old balances: reconcile those against provider
records separately. Tips have authenticated, amount-bound request IDs, fixed
transaction types and linked sender/receiver journal entries. A retry after an
unknown network response replays the same operation rather than transferring twice.

Use `supabase/setup/wallet-audit-operations.sql` for read-only investigation of
overdue receipts, provider success awaiting fulfillment, missing journal entries,
balance discrepancies and unbound historical withdrawals. Never refund a timeout
blindly or edit ledger rows. If transfer verification cannot establish what
happened, keep the saved receipt, reconcile with Chapa and authorize a separately
audited correction only after evidence establishes the outcome. Provider/network
availability cannot be guaranteed by application code.

The separate Shop coin flow currently deducts coins before creating an order and
displays dollar totals. It needs an approved conversion and atomic server-priced
order settlement, or a temporary disablement. No currency conversion, automatic
refund for an ambiguous order, or silent change in shopper charges is introduced
by this wallet release. That product decision remains outstanding.

## Deployment

To deploy using the Supabase Dashboard editor, run
`npm run build:chapa-deployment`. It produces single-file functions with no local
shared-module imports in `deployment/chapa-payment-fix`, plus deployment notes
and the matching SQL files. Create each function using its exact filename stem.
Follow [the wallet release guide](wallet-audit-deployment.md) for this release's
four new SQL migrations and all five functions, including `chapa-transfer`.
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

1. Inspect remote migration history. Apply the November 5 wallet migrations in
   filename order after `20261104140000_verified_chapa_payments.sql` and its existing
   dependencies. Do not rerun already applied schema files.
2. Configure Edge secrets: `CHAPA_SECRET_KEY`, `CHAPA_MODE` (`live` or `test`),
   `CHAPA_WEBHOOK_SECRET`, `CHAPA_RECONCILE_SECRET`, `PAYMENT_RETURN_ORIGINS`
   (comma-separated app origins). Supabase supplies its URL/service-role key.
   Use separate random webhook/scheduler secrets; never put them in Vite variables.
   Optional `CHAPA_LIVE_SECRET_KEY` and `CHAPA_TEST_SECRET_KEY` allow historical
   receipts from both modes to be checked when the active mode changes.
3. Deploy `chapa-initialize`, `chapa-verify`, `chapa-transfer`, `chapa-webhook` and `chapa-reconcile`
   with this repository's function JWT settings. Webhook is public but requires
   its signature; reconciliation verifies the JWT or scheduler secret itself.
4. In Chapa, register the project's `/functions/v1/chapa-webhook` URL and matching
   webhook secret for v1 transaction and payout success/failure/refund/reversal events.
5. In Supabase Vault, configure `chapa_project_url` and `chapa_reconcile_secret`.
   Apply `supabase/setup/chapa-reconciliation.sql` to schedule the minute job.
   Inspect Cron/pg_net failures and intents with persistent `last_error` values.

The November 5 wallet release requires a new manual Supabase deployment; earlier
CORS checks do not validate this schema or fulfillment. Verify all setup steps
and completed scheduler runs after deployment. No real Chapa payment is initiated
by the automated tests.

Provider references: [Chapa v1 webhook verification](https://developer.chapa.co/integrations/webhooks),
[transaction verification](https://developer.chapa.co/integrations/verify-payments),
[refund states](https://developer.chapa.co/refund),
[transfer verification](https://developer.chapa.co/transfer/verify-transfers),
[transfer reference and approval behavior](https://developer.chapa.co/transfer/transfers),
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
It also covers durable uncertain initialization, receipt pagination and ownership,
mode-specific reconciliation, provider check rate limits, fair scheduler batches,
concurrent/uncertain withdrawals, payout webhooks and reversals, destination checks,
tip idempotency, immutable history and legacy accounting baseline integrity.

`npm run test:payment-return-ui` runs the real return screen and wallet hook in
isolated Chrome with mocked endpoints and external requests blocked. It covers
successful test payments, cleared pending storage, reloads, legacy bare returns,
receipt selection, unknown/pending states, unverified success and login redirects,
receipt/status pagination, ledger history beyond 50 entries, account mismatch
rejection, manual recovery and test/live withdrawal confirmation changes.
