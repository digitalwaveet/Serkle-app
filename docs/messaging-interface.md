# Messaging: Option B

The approved direction is implemented across the inbox, direct conversation, group conversation, group profile, and contact profile. The interface preserves Serkle’s brown, gold and cream palette and letter loading animation. The global navigation retains its existing layout.

## Deploy

Run **`supabase/migrations/20261106190000_messaging_groups_and_polls.sql`** in the Supabase SQL Editor for the app’s project, then deploy the matching frontend. This is the only **new** deployment file for this change. No Edge Functions or secrets need to be deployed.

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

Run `npm run test:messaging`, `npm run test:messaging-ui`, and `npm run build`.

The SQL suite executes the actual migration in isolated PGlite with deliberately permissive legacy policies. It covers role enforcement, owner transfer, membership changes, duplicate creation/join requests, expired/revoked invitations, anonymous voting, poll state, private mute settings and avatar permissions. The browser suite mounts the actual components with isolated sample data and blocks external requests. It also tests the real encrypted outbox, unread hook and reaction sync across failure, retry and reload.

Screenshots are written to `test-results/messages` (ignored by Git). Set `MESSAGING_SCREENSHOT_DIR` to another local path to retain review images. The browser suite uses installed Chrome. No real user conversations are modified by these tests.

Production Supabase and multi-device realtime behavior still require a deployment smoke test after applying the SQL. Suggested checks: two test accounts, one group owner and one non-owner; send/read/reload, join/leave, a failed action followed by retry, and an anonymous poll. A full project TypeScript check currently has unrelated pre-existing errors; the messaging changes should add none.
