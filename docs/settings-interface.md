# Settings interface

Settings uses Serkle’s existing brown, gold, logo and letter-wave loader. The
full-screen dialog has a desktop sidebar and a horizontally scrolling category
navigation on phones: General, Privacy, Notifications, Account & security, and
Storage. The navbar and other screens retain their existing layout.

Appearance uses the same ThemeProvider as the profile menu, including system
appearance updates. Theme and autoplay are device preferences. Privacy controls
use the existing profile columns (`is_private`, `hide_followers`,
`hide_online_status`, `allow_messages_from`) through one profile update. A failed
save leaves the previous value selected. Saving privacy settings no longer
sets the global profile loading state and remounts the header.

Account details are masked and loaded from Supabase Auth. Failed account loads
have a retry action. Existing verification, recovery-email, recovery-code and
password-update APIs remain in use. Notification permission, unsupported and
blocked states remain distinct; delivery tests still use the existing push hook.
An accepted installation prompt is not shown as installed until the browser
reports installation.

Clear cache requires confirmation. It removes the persisted query-cache entry
and browser CacheStorage entries, preserving other IndexedDB databases, offline
messages and local account preferences. Storage values come from the browser
estimate; unavailable values and missing quotas have explicit states.

Controls have visible focus styles, associated labels and descriptions, and
44px targets (switches use a 44px label around the smaller track). Nested dialogs
restore focus, password fields clear on close, and transitions respect reduced
motion. Light and dark text contrast is covered by the isolated browser suite.

## Validation

```sh
npm run test:settings-ui
npm run test:profile-updates
npm run test:profile-menu-ui
npm run build
```

UI tests render the actual Settings component with mocked account, notification
and cache services in local Chrome. External requests are blocked. They never
send recovery emails, change real passwords, sign out real accounts or clear
the developer’s offline data.

This change is frontend-only; no Supabase migration or Edge Function deployment
is needed.
