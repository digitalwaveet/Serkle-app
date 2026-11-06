# Ask interface

The Ask redesign keeps Serkle’s brown, gold and cream branding, existing typeface, letter-wave loader and global navigation. It applies a shared visual system to the feed, question detail, posting and story composers, My Ask activity, expert directory and profiles, summaries, threads, filters and confirmation dialogs.

## Components and behavior

- `src/components/ask/ask.css` scopes tokens, spacing, typography, focus styles, touch targets, responsive layouts and dark mode to Ask. Header and FooterNav remain outside that scope.
- `AskDialog` provides consistent scrollable dialogs, nested dialog stacking, accessible close controls and focus restoration. Pending writes cannot close their dialog accidentally.
- `AskState` distinguishes loading, failed requests and empty views. Missing statistics display an em dash; known zero counts remain zero.
- `askPresentation` shares category labels, count formatting, readable anonymous initials, relative timestamps and AI-summary readiness checks.
- Question cards use native buttons for navigation and voting. Search continues to search question text and tags. “From experts” retains the existing meaning: questions authored by verified experts.
- Posting shows the public identity before publishing. An unresolved identity or expert-status request blocks submission. Stored anonymous expert questions retain their anonymous identity.
- Question and reply submissions lock repeated clicks while pending, retain drafts on failure and display an inline retry explanation. These are interface safeguards; they do not replace backend transaction idempotency.
- The old story composer simulated success without saving. It now calls the existing question creation API with `isThread: true`, and reports success only after that API resolves.
- Question detail keeps existing ownership checks, votes, editing, story updates, helpful marking, saving, following and sharing. Destructive actions use confirmation dialogs. Failed helpful marking no longer shows success.
- Community replies precede the AI summary. An “AI summary available” badge requires stored ready metadata with real content. Generation remains an explicit action; anonymous original authors’ public names are masked in its payload.
- Featured expert answers navigate to their question IDs. Expert profiles retain the existing messaging action and verified-presence hook. Unknown presence uses neutral text.
- My Ask activity keeps Questions, Answers and Saved views. Expert verification uses the Ask dialog appearance only when launched from Ask; the shared component retains its default appearance elsewhere.

All 13 pre-existing files in `src/components/ask` are updated. New shared components are `AskDialog`, `AskState`, `AskReplyComposer` and `AskConfirmDialog`.

## Validation

```sh
npm run test:ask-presentation
npm run test:ask-ui
npm run build
```

The presentation tests cover 0/1/multiple counts, unknown counts, summary readiness, category keys and readable anonymous initials. Browser tests exercise real Ask components with isolated service fixtures, including identity modes, pending and failed writes, duplicate clicks, story persistence payloads, saved activity, owner controls, expert navigation, messaging, verification, AI generation, focus restoration, 320px layouts and light/dark contrast. External requests are blocked; the tests do not create real questions, replies, votes, messages or applications.

Visual checks cover feed, composer, question detail, activity, experts, profiles, story and remaining widgets at mobile and desktop sizes in light and dark themes. Fixtures and their component gallery are test-only and are not added to the app’s routes.

## Deployment and limits

Deploy the frontend normally. No new database migration or Supabase Edge Function is required. Existing backend permissions, category keys and feed query semantics are preserved. The feed retains its existing first-page limit of 20 questions; this change does not add pagination or alter membership/payment behavior.

Repository-wide TypeScript checking still reports the same 48 pre-existing errors outside the modified files. No changed Ask, shared-component or fixture file reports a TypeScript error. The production build and targeted Ask checks are separate validation steps; a successful build does not imply that the existing repository-wide typecheck is clean.
