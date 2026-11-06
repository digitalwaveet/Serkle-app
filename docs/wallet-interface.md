# Wallet interface

The wallet uses Serkle's existing warm brown, golden orange and cream palette,
logo and Inter/system font stack. The existing `SerkleLoader` and its letter-wave
animation are unchanged. Styles are scoped in `src/components/wallet/wallet.css`
and use the app's light/dark theme. Large balances use tabular numerals; receipt
IDs remain selectable text, with full references available in copy/print output.

The responsive interface places the balance overview beside the activity or
form on desktop and above it on mobile. History separates payment attempts from
actual coin movements. Top-up has amount/review steps. Withdrawals retain the
explicit confirmation, mode check and saved-reference recovery flow. No prices,
coin balances, payment endpoints or entitlement rules are changed by the design.

Wallet, receipt and withdrawal-confirmation dialogs trap keyboard focus, support
Escape where appropriate, and restore focus to their opener. Inputs have visible
associated labels and linked validation guidance. Controls target at least 44px.
Core labels, status text, guidance, buttons and receipt fields are checked for
4.5:1 contrast in light/dark themes. Status has text and icons in addition to
color. New panel transitions and the existing loader respect reduced motion.
The test coverage is not a certification of the entire application's accessibility.

Receipts render saved server fields and linked ledger entries. A pending attempt
never displays a paid stamp; a test receipt is explicitly marked as a test with
no real wallet movement. Unknown fees/timestamps are labeled as unavailable,
not fabricated. The paper design includes Serkle branding, amount, environment,
status, merchant/provider references, method, fees, timestamps, masked payout
destination when present and actual coin movements. The audit timeline remains
available below the receipt. Copy and Print / Save PDF do not start a payment.
Print CSS includes only the receipt, without wallet navigation or action buttons.
This is a wallet transaction record, not a tax invoice or provider-issued invoice.

Loading and unavailable balances are explicit; a failed query does not display a
fictional zero. Bank-list failures expose a retry and disable withdrawal requests
until configuration is available. Existing backend verification, idempotency,
owner checks and test/live money separation remain authoritative.

Validation: `npm run test:payment-return-ui` runs the styled UI against isolated
mock services with all external requests blocked. It covers payment recovery,
pagination, account isolation, 320px layouts with long identifiers, focus, form
labels, copy/print, loading, empty/error states, bank retry, reduced motion and
contrast. `npm run test:payments` retains financial/SQL regression coverage.
The fixture is never used in production and does not initiate real transactions.

This redesign is frontend-only and adds no database migration or Edge Function.
The previously documented wallet backend deployment is still required for the
receipt APIs. Existing unrelated project TypeScript errors are tracked separately.

Accessibility references: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
