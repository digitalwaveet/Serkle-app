# Notification panel, full page and preferences

The Header bell opens an anchored Radix dialog with Serkle’s existing brown,
gold, typography and letter-wave loader. The navbar layout is unchanged. The
panel fits the viewport, scrolls its activity list independently, and keeps the
View all notifications action visible. All, Unread, Social, Circles, Shop,
Safety and Messages filters retain their existing meanings and destinations.

The full `/notifications` page uses the same filter component, batch adapter and
activity cards. It retains the 480px app layout and existing bottom navigation,
with a branded header, unread summary, sticky filters and daily activity groups.
It renders every loaded entry, rather than the dropdown’s 15-entry group preview.
The existing 50-notification query limit is unchanged.

Clear all requires explicit confirmation describing its scope across every
category. The dialog remains open on failure, and success is shown after the
existing API mutation succeeds. Story mentions retain the existing reshare
confirmation, authenticated story insert and 24-hour lifetime. Repeated submits
are blocked while pending, and failed lookup/insertion keeps a retryable error
visible. These tests use sample story metadata, never a real story insert.
The page's mention subscription is filtered to the current account and checks
the notification owner before showing a mention toast.

The panel has explicit unread labels, neutral relative timestamps with a full
local timestamp on hover, sender/profile shortcuts, and touch-accessible row
menus for marking read and deleting. Missing sender images use initials or an
activity icon. Invalid/missing timestamps show Time unavailable. Urgent styling
is limited to unread safety notifications.

The panel adapts the existing batch format before rendering. It retains every
underlying record ID and uses the latest record’s timestamp for time grouping.
Unread state considers all records, including an unread older record under a
read latest record. Missing profile queries produce an accurate generic group
title. Mark-read operates on the unread IDs; deleting a group removes its IDs
through the existing mutation. Rows remain visible until the mutation succeeds,
and failures show an inline error. Actions are disabled while a write is pending.

Loading, initial query failure, failed refresh with cached data, empty inbox,
and empty filtered categories are distinct. Retry uses the existing query’s
refetch function. The existing 50-record query limit and 15-entry preview per
time group are unchanged; the panel points users to all notifications for more.
No backend counts, permissions or notification delivery rules were changed.

The nested preferences dialog uses the same visual tokens and existing
preference keys, with associated switch labels, save feedback, a pending loader,
and a retry state when saved preferences cannot load. The SOS switch remains
read-only here. Copy distinguishes device-only category/sound/banner choices
from account-level master and safety settings, matching the existing hook.

Dialog and menu primitives manage keyboard navigation, Escape, focus trapping
and focus restoration. Preferences and row menus render above the parent panel
without dismissing it. Browser Back continues through Header’s existing
NavigationContext. Controls provide 44px targets, text contrast is checked in
both themes, and motion respects the reduced-motion preference.

## Validation

```sh
npm run test:notification-entries
npm run test:notifications-ui
npm run test:notifications-page-ui
npm run test:profile-menu-ui
npm run build
```

The browser fixture renders the real Header, panel, preferences and styles with
mocked queries and mutations. It blocks external requests. No real notification,
preference, password or account is modified by these tests.

This is a frontend update. No Supabase migration or Edge Function deployment is
required.
