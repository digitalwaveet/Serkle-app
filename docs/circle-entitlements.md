# Circle entitlements and payments

For the verified Chapa wallet funding, webhook, receipt recovery and deployment
pipeline, see [Chapa payment lifecycle](chapa-payment-lifecycle.md).

## Confirmed product rules

The product owner confirmed that a Circle subscription includes every premium
post, video and resource in that Circle. Events and services remain separate;
their prices must be displayed and the customer must explicitly submit a purchase.

Lifecycle defaults were delegated to implementation:

- Each new subscription payment grants one calendar month, calculated in UTC.
  Month-end dates clamp to the last day of the following month.
- Renewals are explicit purchases, not automatic wallet debits. An active term
  extends from its existing end; an expired/refunded term restarts immediately.
- Cancellation stops renewal intent; the paid period remains accessible.
- A full refund revokes the corresponding grant immediately. Other unrefunded
  terms and one-time purchases remain independent. No partial/prorated refunds.
- Existing unrefunded one-time unlocks survive subscription expiry/refund.
- Existing active subscriptions with no expiry retain their legacy access. Their
  original paid term cannot be reconstructed safely, so no expiry is invented.

## Audit findings addressed

| Before | Implementation |
| --- | --- |
| Videos checked one-time unlocks, ignoring subscriptions | `circle_content_access` serves post/video/resource checks |
| Frontend subscription query checked only `status` and shared cache across users | Authenticated backend subscription RPC, account-scoped query keys, expiry timer and polling |
| Subscription/service charges preceded separate grant/booking requests | One transactional purchase RPC per flow |
| Generic wallet RPCs trusted a client-supplied payer and amount sign | Authenticated payer validation; positive whole-coin prices from stored products |
| Subscription/unlock rows allowed direct client inserts | Direct grant writes revoked; payment RPCs create grants |
| Feed/detail RPCs exposed premium bodies under `SECURITY DEFINER` | Existing signatures retained; locked payloads redacted on the server |
| Resources showed “Unlock” but downloaded without an entitlement check | Backend `can_access` decision and object RLS gate downloads |
| Public buckets bypassed all object RLS for legacy URLs | Shared post media and Circle videos made private; updated readers request signed URLs |
| Event registration did not charge its displayed fee | Atomic separate purchase; meeting/recording data withheld until paid |
| Refunds were not tied to content grants | Receipt-specific revocation and atomic wallet/ledger reversal |

The backend uses `auth.uid()`, not a supplied payer identity. It checks the price
against the reviewed quote before debit. A buyer-scoped PostgreSQL advisory lock,
wallet row locks in consistent order, grant uniqueness and durable request IDs
prevent retry and concurrent-request duplicate charges. Renewals also compare the
quoted expiry so two tabs cannot accidentally buy two extensions.

Frontend purchase request IDs survive network failures and reloads. They are
removed only after a definitive successful result or confirmed expired/refunded
receipt. Receipt retries never reactivate a refunded purchase.

## Refund APIs

- `refund_circle_payment(payment_id)`: creator/seller or platform admin; full
  refund of a new content/subscription payment, exactly once.
- `refund_circle_purchase(kind, content_id, buyer_id)`: also handles legacy
  one-time unlocks, importing the selected receipt before refunding it.
- `refund_circle_booking(payment_id)`: seller/admin reverses a separate event or
  service purchase and revokes that booking's paid state.
- `refund_legacy_circle_subscription(transaction_id)`: platform admin only;
  requires a real negative historical subscription ledger receipt. The old flow
  burned coins rather than paying the creator, so this reverses that debit
  without charging an uninvolved creator. A unique receipt key prevents replay.

New seller-funded refunds fail atomically when the seller cannot fund them;
neither access nor balances are partially changed. A platform operator must
resolve insufficient seller funds before retrying.

## Deployment

Apply these migrations in order against the project's existing schema:

1. `20261102150000_circle_entitlements.sql`
2. `20261102151000_circle_content_security.sql`
3. `20261102152000_circle_post_rpc_entitlements.sql`
4. `20261102153000_circle_separate_purchases.sql`

Deploy the updated frontend in the same release window. The private-bucket change
intentionally invalidates legacy public media URLs; old client builds need an
update. The updated shared-bucket readers handle personal posts, profile grids,
saved posts and thread attachments as well as Circle content. Do not fall back to
public URLs or client-side grant inserts if a new RPC is unavailable.

The workspace has not been deployed to Supabase: the CLI link attempt requires
`supabase login` or a configured `SUPABASE_ACCESS_TOKEN`. Inspect remote migration
history after authenticating; do not blindly push unrelated pending migrations.

Entitlement revocation is immediate at the database/API layer. Already issued
signed media URLs remain usable for at most 60 seconds, and already downloaded
files cannot be recalled. Circle screens revalidate on an expiry timer and
15–30-second polls; an already rendered screen may update on the next poll.

## Integration tests

Run `npm run test:circle-entitlements`. Tests execute the actual production SQL
migrations and RPCs against isolated PGlite PostgreSQL with Supabase auth/role and
storage-schema fixtures. They exercise authenticated and anonymous roles, RLS,
redacted API payloads, grants, wallets and ledger rows. The suite also renders the
real video card/player with backend results to verify granted access removes the
purchase prompt and expired/refunded/unknown states remain locked. Frontend
network calls are replaced in this rendering harness. No live coins are spent.

Coverage includes active/free/owner/unknown access, private and cross-Circle
scope, expiry, renewal, month ends, cancellation, subscription/content/booking
refunds, legacy receipts, price changes, insufficient funds, failure after debit,
forged payer/self-grants, retries, and multiple simultaneous purchase submissions.

PGlite serializes a single database engine's execution. The concurrent-submission
tests verify deduplication and ledger outcomes; deployment verification should
also exercise the same RPCs through separate PostgreSQL connections in staging.
