# Profile dropdown

The Header uses `ProfileDropdown` for the existing avatar menu. Header layout,
destinations, unread-message counts, refresh and sign-out handlers remain in the
Header; the dropdown supplies their presentation and interaction. Styles are
scoped in `profile-dropdown.css` using Serkle's brown, gold and cream palette,
the existing font stack and light/dark theme variables.

The menu presents the account summary, wallet shortcut, Search/View profile/
Messages, preferences with appearance choices, and refresh/logout actions. The
wallet displays actual coins without the old incorrect dollar equivalent.
Loading uses the existing Serkle loader; failed balance queries show unavailable.
No balances, exchange rates, purchases or backend rules are changed.

Radix menu primitives provide focus movement, typeahead, Escape, outside-click
dismissal, trigger focus restoration and checked theme choices. Opening another
modal hands focus to that screen. Theme selection keeps the menu open for
preview. Browser Back continues to use the existing navigation context. Actions
have at least 44px height; the menu scrolls on short screens and truncates long
account names visually while retaining their accessible name.

Run `npm run test:profile-menu-ui` for the styled Header integration fixture.
Tests cover the existing action callbacks, keyboard/dismissal behavior, theme
persistence, narrow-screen scrolling, loading/errors, count preservation and
light/dark text contrast. The fixture blocks external requests and mocks refresh
and sign-out; no real account is signed out or modified by the tests.

This is a frontend change with no database migration or Edge Function deployment.
