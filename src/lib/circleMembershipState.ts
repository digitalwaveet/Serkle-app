export type CircleMemberState = 'guest' | 'owner' | 'manager' | 'joined' | 'pending' | 'join' | 'subscription_required' | 'restricted' | 'unavailable';

export interface CircleMembershipSnapshot {
  circle_id: string;
  creator_id?: string;
  user_id: string | null;
  state: CircleMemberState;
  status?: string | null;
  role?: string | null;
  has_subscription?: boolean;
  premium_locked?: boolean;
}

export const CIRCLE_MEMBERSHIP_QUERY_KEYS = [
  'circle', 'circles', 'circles-search', 'my-circles', 'owned-circles',
  'circle-invite-preview', 'circle-members', 'circle-join-requests',
  'circle-invitations', 'circle-subscription', 'circle-posts', 'circle-videos', 'circle-resources',
] as const;

/** Membership and paid content access are separate. Expiry must never turn an
 * existing member into a non-member or offer them another Join action. */
export function circleMembershipAction(snapshot: CircleMembershipSnapshot | undefined | null, busy = false) {
  const state = snapshot?.state;
  const label = state === 'owner' || state === 'manager' ? 'Manage'
    : state === 'joined' ? 'Joined'
    : state === 'pending' ? 'Pending approval'
    : state === 'guest' ? 'Sign in'
    : state === 'subscription_required' ? 'Subscribe'
    : state === 'join' ? 'Join'
    : state === 'restricted' ? 'Membership restricted'
    : state === 'unavailable' ? 'Unavailable'
    : 'Checking membership…';
  return {
    label: busy ? 'Please wait…' : label,
    disabled: busy || !state || ['pending', 'restricted', 'unavailable'].includes(state),
    canManage: state === 'owner' || state === 'manager',
    canLeave: !!snapshot?.user_id && snapshot.status === 'active' && state !== 'owner'
      && snapshot.creator_id !== snapshot.user_id,
    isJoined: ['owner', 'manager', 'joined'].includes(state || ''),
    canSubscribe: !!snapshot?.premium_locked && (state === 'joined' || state === 'pending' || state === 'manager'),
  };
}

/** Ignore persisted snapshots belonging to an earlier account. */
export function validateCircleSnapshot(value: CircleMembershipSnapshot | undefined, circleId: string, userId?: string) {
  if (!value || value.circle_id !== circleId || value.user_id !== (userId || null)
    || !['guest', 'owner', 'manager', 'joined', 'pending', 'join', 'subscription_required', 'restricted', 'unavailable'].includes(value.state)) {
    throw new Error('Could not verify Circle membership. Please retry.');
  }
  return value;
}
