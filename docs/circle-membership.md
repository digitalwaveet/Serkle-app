# Circle membership

`circles.creator_id` is authoritative ownership. A Circle has at most one
`circle_members` row per user. Membership and premium content access are separate.

| Server state | Primary action | Behavior |
| --- | --- | --- |
| guest | Sign in | Existing login flow returns to the Circle or invitation |
| owner | Manage | Works even if a legacy owner membership is missing |
| manager | Manage | Active admin/creator-role membership |
| joined | Joined | May leave; subscription expiry does not remove membership |
| pending | Pending approval | Disabled; no duplicate request |
| join | Join | Public: active; private: pending approval |
| subscription_required | Subscribe | Review price and explicitly purchase first |
| restricted | Membership restricted | Banned/removed users cannot rejoin |
| unavailable | Unavailable | Missing or inactive Circle |
| unverified/error | Checking membership / Retry | Never assume the user is a nonmember |

Members, pending requesters and non-owner managers can see a separate Subscribe action when premium access is
missing. Active subscriptions are verified using the existing backend entitlement
function, including expiry/refunds. A private invite code permits a preview and
request; it does not bypass approval or the subscription requirement. A pending
requester whose required subscription expired must renew before approval.

All membership changes use authenticated RPCs. The backend reads the caller from
`auth.uid()` and verifies ownership/role, Circle privacy and subscription coverage.
Direct client membership/invitation writes are revoked. Creating a Circle inserts
its owner membership atomically. Manager invitations validate the current owner,
the invitee and any restrictions; ownership transfers retain both users' rows.

Join/leave/approval/invitation/transfer actions lock the Circle in a consistent
order. The existing `(circle_id,user_id)` uniqueness constraint prevents duplicate
memberships. Join request IDs persist across lost responses and reloads; replaying
an old request after decline/leave returns the current state without reopening it.
Declined, left and removed rows retain history and do not count as active members.
The existing count trigger runs only on actual active-state transitions.

Leave Circle is available to every active non-owner member, including admins
and members of inactive Circles. The confirmation stays open on API errors and
blocks repeated clicks while processing. Only a validated server response may
show success or navigate away. It updates cached membership flags, Joined,
Created, Discover/search, member lists and the absolute server member count
before refetching. In-flight older queries are cancelled to prevent stale Joined
state from returning. Private Circles without remaining paid access disappear
from browse/search as well as Joined.

The leave endpoint accepts a Circle ID and request ID, never a target user ID.
It derives the caller from `auth.uid()`, preserves the membership row as `left`,
blocks owners and retains bans/removals. Persisted leave intent IDs make retries
safe, including after a subsequent rejoin. Owners must transfer ownership and
wait for acceptance before explicitly leaving as a member, or explicitly delete
their Circle using the separate deletion confirmation. Transfer alone does not
remove the former owner's membership.

Leaving never changes paid subscriptions, renewal settings, billing records,
refunds or one-time purchases. The confirmation states this explicitly.
Subscription controls remain available on the profile after leaving, including
private Circles with continuing paid access. Cancelling renewal requires a
separate explicit action.

The frontend uses shared server snapshots for cards, profiles, invite pages and
management permissions. Snapshots are scoped to the current account. Successful
actions invalidate related Circle queries, including both collections, search,
requests and membership lists. Queries refetch on mount, reconnect, focus and at
15-second intervals while visible, so another manager's decisions become visible
without requiring realtime publication configuration.

Validation: `npm run test:circle-membership` runs the real migration and existing
count/subscription functions in isolated PGlite PostgreSQL. Tests cover roles,
approval/decline, retries, batched snapshots, legacy owners, premium lifecycle,
invitations, permission failures, cached-query refresh, login returns and rendered
cards/buttons. Concurrent requests are queued by PGlite; production PostgreSQL
serialization is enforced by row locks and unique constraints.

`npm run test:circle-leave-ui` runs the real profile, mutation hook and confirmation
in headless Chrome using a local mocked Supabase fixture. It tests Stay, failure,
busy/duplicate protection, success navigation and counts, post-leave subscription
controls, admin leaving and owner transfer policy. It blocks external requests
and does not use the user's browser profile or connected accounts.

Apply `20261104120000_circle_membership_state_machine.sql` and then
`20261104130000_circle_leave_flow.sql` after the earlier Circle
entitlement migrations before releasing the matching frontend. No live database
changes are made by these tests. Deployment requires a linked Supabase project
and an authenticated Supabase CLI session.
