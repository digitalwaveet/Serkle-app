import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateCircleSnapshot, type CircleMembershipSnapshot } from './circleMembershipState.ts';

export interface CircleLeaveResult extends CircleMembershipSnapshot {
  leave_confirmed: boolean;
  membership_changed: boolean;
  replayed: boolean;
  members_count: number;
  circle_visible: boolean;
}

export const CIRCLE_LEAVE_SUBSCRIPTION_NOTICE = 'Leaving does not cancel any paid subscription, change renewal settings, stop billing, or issue a refund. Manage your subscription separately.';
export const CIRCLE_OWNER_EXIT_POLICY = 'Transfer ownership and wait for the new owner to accept. You will remain a member and can then choose Leave Circle. You can also explicitly delete the Circle.';

const pendingLeaves = new Map<string, Promise<CircleLeaveResult>>();
export function requestCircleLeave(client: Pick<SupabaseClient, 'rpc'>, circleId: string, userId: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage) {
  const key = `circle-leave:${userId}:${circleId}`;
  const pending = pendingLeaves.get(key);
  if (pending) return pending;
  const request = (async () => {
    let requestId = storage.getItem(key);
    if (!requestId) { requestId = crypto.randomUUID(); storage.setItem(key, requestId); }
    const { data, error } = await client.rpc('leave_circle' as any, { _circle_id: circleId, _request_id: requestId });
    if (error) throw error; // Keep the ID if the server may have processed it.
    const result = validateCircleSnapshot(data as unknown as CircleLeaveResult, circleId, userId) as CircleLeaveResult;
    if (result.leave_confirmed !== true || result.status !== 'left' || result.state === 'owner'
      || !Number.isInteger(result.members_count) || result.members_count < 0) {
      storage.removeItem(key);
      throw new Error('Leaving was not confirmed. Refresh your membership and try again.');
    }
    storage.removeItem(key);
    return result;
  })();
  pendingLeaves.set(key, request);
  void request.finally(() => { if (pendingLeaves.get(key) === request) pendingLeaves.delete(key); }).catch(() => {});
  return request;
}

const circleKeys = ['circle', 'circles', 'circles-search', 'my-circles', 'owned-circles', 'circle-invite-preview', 'circle-members', 'circle-join-requests'];
function accountForKey(key: QueryKey) {
  return ['circles', 'my-circles', 'owned-circles'].includes(String(key[0])) ? key[1] : key[2];
}

/** Apply the confirmed server snapshot/count before any refetch or navigation.
 * Never decrement a cached count: different queries can hold different ages. */
export async function applyCircleLeaveResult(queryClient: QueryClient, result: CircleLeaveResult) {
  const relevant = (key: QueryKey) => circleKeys.includes(String(key[0]));
  await queryClient.cancelQueries({ predicate: query => relevant(query.queryKey) });
  const update = (circle: any, own: boolean) => ({ ...circle, members_count: result.members_count,
    ...(own ? { creator_id: result.creator_id || circle.creator_id, membership_state: result,
      is_joined: false, is_pending: false, is_owned: false, is_admin: false, member_role: undefined } : {}),
  });
  for (const query of queryClient.getQueryCache().getAll()) {
    const key = query.queryKey;
    if (!relevant(key) || query.state.data == null) continue;
    const own = accountForKey(key) === result.user_id;
    queryClient.setQueryData(key, (data: any) => {
      if (key[0] === 'circle-members' || key[0] === 'circle-join-requests') {
        return key[1] === result.circle_id && Array.isArray(data) ? data.filter(row => row.user_id !== result.user_id) : data;
      }
      if (Array.isArray(data)) return data.flatMap(circle => {
        if (circle.id !== result.circle_id) return [circle];
        if (own && (key[0] === 'my-circles' || key[0] === 'owned-circles' || result.circle_visible === false)) return [];
        return [update(circle, own)];
      });
      return data?.id === result.circle_id ? update(data, own) : data;
    });
  }
}
