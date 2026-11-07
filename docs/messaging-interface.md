# Messaging: Option B

The approved direction is implemented across the inbox, direct conversation, group conversation, group profile, and contact profile. The interface preserves Serkle’s brown, gold and cream palette and letter loading animation. The global navigation retains its existing layout.

## Deploy

Run these files in order in the Supabase SQL Editor for the app’s project, then deploy the matching frontend:

1. `supabase/migrations/20261106190000_messaging_groups_and_polls.sql`
2. `supabase/migrations/20261107140000_messaging_delivery_repair.sql`

No Edge Functions or secrets need to be deployed. Run `npm run check:messaging-backend` to check that both sets of functions are installed and deny anonymous callers. This command makes read-only requests using the project's public key; it never sends messages or creates groups. An installed API still needs the signed-in smoke checks below.

Use the latest complete files from GitHub, especially if a previous run reported `42P13: cannot change return type of existing function`. The corrected migrations recreate the named RPC endpoints before defining their current return contracts, including legacy boolean, JSON and TABLE results. They do not use `CASCADE` or delete messages, members or uploaded files. Both fresh installation and reapplication with existing data are covered by the migration tests.

Existing chat schema and privacy migrations must already be present, including `20260921090000_chat_privacy_and_receipts.sql` and `20260921091000_guard_conversation_list.sql`. Do not rerun historical migrations indiscriminately. The new migration adds group support tables if absent, guards direct writes, and creates the authenticated group, invitation and poll RPCs used by these screens.

Group creation uses a stable request UUID. Owner transfer is explicit; the previous owner keeps admin access until they leave or their role changes. Non-owner members may leave after confirmation. Admin removal or departure clears stale roles and revokes invitations they issued. Group invitation links expire in seven days, require an explicit join, and can be revoked. QR codes are generated locally.

Poll creation and the associated chat message share one database transaction. Votes are serialized, idempotent, and checked against membership and poll state. Anonymous polls expose totals and the current user’s selections, without other voters’ identities.

## Behavior

- Badges use actual incoming unread messages, including conversations whose latest message was sent by the current user. Zero and unknown counts are hidden; `99+` changes only the displayed badge, with the full count in its accessible label. Arrival sequences, rather than edit sequences or gaps, determine unread status.
- Only the existing reliable presence hook can show online status. Historical or unavailable presence stays neutral.
- Text is cleared after an atomic encrypted local message/outbox save. Offline messages remain queued. Attachment and voice retries retain their uploaded references and message IDs; a partial batch resumes its remaining items.
- Edit, delete, reaction, forward, group and membership actions report failures without closing successful-looking dialogs. Forward retries reuse destination IDs; a rejected edit restores its prior saved content.
- Shared media, files, links, audio and voice are separate categories. Counts explicitly describe loaded items, with paginated older history. Private references stay stable while signed URLs load; deleted messages are excluded, including per-user deletions. Failed attachments can be retried. Missing or invalid video durations have no duration badge.
- Mobile profiles use focus-trapped dialogs with focus restoration; desktop profiles use a dismissible side panel. Touch actions have visible controls, accessible names and keyboard support. Motion respects the reduced-motion setting.

## Local validation

Run `npm run test:messaging`, `npm run test:messaging-delivery`, `npm run test:messaging-ui`, and `npm run build`.

The SQL suite executes the actual migration in isolated PGlite with deliberately permissive legacy policies. It covers role enforcement, owner transfer, membership changes, duplicate creation/join requests, expired/revoked invitations, anonymous voting, poll state, private mute settings and avatar permissions. The browser suite mounts the actual components with isolated sample data and blocks external requests. It also tests the real encrypted outbox, unread hook and reaction sync across failure, retry and reload.

Screenshots are written to `test-results/messages` (ignored by Git). Set `MESSAGING_SCREENSHOT_DIR` to another local path to retain review images. The browser suite uses installed Chrome. No real user conversations are modified by these tests.

Production Supabase and multi-device realtime behavior still require a deployment smoke test after applying the SQL. Suggested checks: two test accounts, one group owner and one non-owner; send/read/reload, join/leave, a failed action followed by retry, and an anonymous poll. A full project TypeScript check currently has unrelated pre-existing errors; the messaging changes should add none.

## November 7 production audit and repair

Read-only live probes confirmed `PGRST202` for the new group-creation signature and invitation RPC: the matching migration was absent. The UI now identifies this setup failure and retains its selections, without silently falling back to the old creation endpoint.

Legacy chat attachments were still rendered with `/object/public/post-media/` URLs, while the shared bucket had been made private for Circle content security. Authenticated signing of those same existing files restored loading in the signed-in app. Public, authenticated and stale signed references are now parsed by project origin and stable object path and renewed through Storage RLS. Tokens remain ephemeral; foreign origins and unsupported buckets never receive signing requests. No bucket was made public and no files were moved or re-uploaded.

The collapsed galleries came from media columns having only a maximum width and children whose image sizes depended on that unresolved width. Explicit column widths and a CSS grid now keep loading, failed and successful tiles at useful sizes. Regression screenshots cover two, three, four and six images at 320, 390 and 548 pixels. Header icon contrast, short-screen dialog actions and friend-search spacing are also checked.

Delivery now verifies stored message rows and their server sequence after a write. A lost response reuses the original ID and existing row. Retry exhaustion keeps the exact outbox payload and a readable error; manual retry and reload are tested. Batches preserve offline creation order and are isolated by conversation, so a revoked chat does not block another. Cached per-user deletions are synchronized, and conversation previews exclude deleted content. Visible chats refresh on focus, reconnect and periodically when realtime events are missed.

The additional backend suite uses the actual Supabase JavaScript client over a local HTTP API backed by PGlite and the real SQL migrations, including deliberately permissive legacy policies. It verifies acknowledgements, lost responses, atomic batches, identity and membership guards, private storage scope, group creation and safe migration reapplication. Browser storage tests execute the actual encrypted outbox and sync implementation. Storage rendering tests execute the actual reader and Storage SDK against isolated HTTP responses, including private buckets, expired links, denied access and missing objects. None of these tests write to production conversations.
