# Serkle systems and admin audit

The review mapped app routes, data ownership, Supabase migrations and functions, provider boundaries, and admin controls. The local browser session had a member account, so the authenticated admin screens and production provider delivery could only be assessed through source and isolated tests.

## Changes in this update

- Admin access comes from Supabase `user_roles` for the current session. Admin and super admin are admitted. Members and moderators see an access message. A failed role check offers a retry, and the browser does not persist admin query results in IndexedDB.
- The operations dashboard shows links to review queues, active SOS counts, global record totals, and new profiles for the last seven UTC calendar days. The aggregate endpoint validates the caller before returning any counts. The client shows an error when the request fails or returns an incomplete response.
- Platform Health checks the admin database request and the current authentication session. External services have a named unchecked state. Active SOS counts include only `active` and `responding` alerts.
- The review queue supports filtered pagination and verifies that a claim changed a pending row. Resolving an item saves the queue decision, applicable post status, and audit entry in one transaction. The transaction rejects a second decision on the same item and rolls back if a required write fails.
- Audit inserts require the actor to match the authenticated caller. Existing screens that write their log in a separate request report a warning when that write fails. The admin layout renders feedback from screens using Sonner.

## System inventory

| System | Source reviewed | Admin coverage and remaining verification |
| --- | --- | --- |
| Signup, sign-in, recovery, profiles and presence | `UserContext`, `authIdentity`, profile and presence helpers, `send-email`, `send-sms` | Users, Roles and Expert Verification exist. Verify production OTP delivery, OAuth redirects, legacy phone sign-in, and session revocation. A successful Authentication check verifies the current session only. |
| Feed, posts and comments | Feed and detail RPC migrations, Create Post, admin content and reports pages | Counts are authoritative for the dashboard. Feed and detail read paths need an enforcement audit for `moderation_status`. Repository reads reviewed here do not use that field to consistently suppress content. |
| Stories | Story context, editor, viewer, publishing services and media helpers | Stories have a dashboard count. The admin panel has no dedicated Stories workflow. Check publishing, expiration, and real-device rendering. |
| Relax and video uploads | Relax player, video creation, progress and resumable upload helpers | Videos have a management page. Check production bucket size, interrupted uploads and quality fallback on actual devices. The build contains large HLS and media chunks worth measuring on slower connections. |
| Circle | Membership and role RPCs, entitlement migrations, premium previews, signed media, owner and member screens | Circle admin has a membership list and removal flow. Both the list of Circles and the member list have fixed 100-row caps. Verify owner, admin, member, paid, refunded and renewed flows against the deployed schema. |
| Ask and expert verification | Ask question, answer and expert routes, anonymity helpers and migrations, admin moderation actions | Some Ask moderation actions display success before verifying the write. The question list is capped at 100. Review moderation permissions and anonymization together before expanding identity access. |
| Direct and group messaging | Message delivery receipts and RPCs, chat media and local sync | Messages oversight reads up to 200 recent messages and filters locally. The dashboard uses only totals. Verify whether operator access to private message bodies is required and narrow access to approved report evidence. |
| Search, maps and location | Search modal, location search and reverse geocoding, `get-mapbox-token` | Search is a separate app workflow. Address lookup and Mapbox-backed maps can have different failure modes. Validate browser permission denial and live third-party availability independently. |
| Notifications, email and push | Notification inbox, preferences, push subscription and service worker, edge delivery functions | Alerts and Broadcasts cover admin workflows. There is no end-to-end delivery monitor. Validate foreground and background receipt and notification click-through on installed devices. |
| Wallet, coins and payment recovery | Chapa initialization, verified webhook and reconciliation functions, wallet history, ledger and entitlement SQL | The admin navigation lacks a payments and reconciliation queue. Provider success, refunds, ledger corrections and webhook delays need a read-only support view with access controls before adding operator recovery actions. |
| Shop | Catalog, carts, seller and order routes, dispute flows and admin Shop Management | The dashboard links open disputes to Shop Management. Check that each seller, product and dispute mutation verifies that a row changed. Product and seller lists have fixed caps. |
| SOS and helpers | Safe and SOS screens, location permissions, helper and emergency-contact functions, Safety Operations | Dashboard counts use the existing active status definition. Admin action acknowledgement and dispatch delivery need staging verification without sending real emergency alerts. |
| Live streaming | WebRTC signaling, stream lifecycle and notification functions, admin Live Streams | The dashboard counts streams marked live. This does not measure playable streams or cross-network connectivity. Verify start, join, reconnect and end on separate networks. |
| Moderation, reports, appeals and settings | Review queue, reports, appeals, AI and bulk moderation, settings and webhook screens | The queue now confirms writes and records decisions atomically. Other surfaces still contain separate or unchecked writes, and operational lists have fixed caps. Treat a saved decision and verified public removal as separate checks. |
| Media, infrastructure and PWA | Storage-reference resolver, signed media, image-preview endpoint, Vercel configuration and service worker | Storage and Edge Function delivery are currently unchecked on Platform Health. Verify a sample from each migrated bucket, as well as fresh and upgraded PWA installs. Repository checks cannot validate production object availability or Android wrapper behaviour. |

## Deployment and verification

1. Apply `supabase/migrations/20261127120000_admin_operations.sql` to the Serkle Supabase project before deploying the frontend. It adds two RPCs and tightens the existing audit insert policy without modifying existing rows.
2. Verify the dashboard with one authorized admin account and one ordinary member account in staging. Open Health, check the database and authentication rows, and confirm that provider rows remain unchecked.
3. Use staging review items to test claim, resolution, audit attribution, and a second attempt on an already resolved item. Verify that the reported decision and the rendered content agree separately.

Run the focused fixtures with `node --experimental-strip-types --test src/tests/admin-operations.integration.test.ts src/tests/admin-operations.ui.test.ts`. The PostgreSQL fixture covers role access, exact aggregate and UTC date handling, duplicate decisions, audit attribution, and rollback. The browser fixture uses local sample data to check mobile rendering, access retry and account switching, plus successful, unavailable, and unchecked health states.
