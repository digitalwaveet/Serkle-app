import type { QueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CIRCLE_MEMBERSHIP_QUERY_KEYS, validateCircleSnapshot, type CircleMembershipSnapshot } from './circleMembershipState.ts';

export const membershipQueryOptions = { staleTime: 0, refetchOnMount: 'always' as const, refetchInterval: 15_000 };

export async function fetchCircleMemberships(client: Pick<SupabaseClient, 'rpc'>, circleIds: string[], userId?: string) {
  const snapshots = new Map<string, CircleMembershipSnapshot>();
  for (let from = 0; from < circleIds.length; from += 100) {
    const ids = circleIds.slice(from, from + 100);
    const { data, error } = await client.rpc('get_circle_membership_states' as any, { _circle_ids: ids });
    if (error) throw error; // A failed check must never become a Join action.
    for (const id of ids) snapshots.set(id, validateCircleSnapshot((data as unknown as CircleMembershipSnapshot[])?.find(row => row.circle_id === id), id, userId));
  }
  return snapshots;
}

export async function refreshCircleMembership(queryClient: QueryClient) {
  await Promise.all(CIRCLE_MEMBERSHIP_QUERY_KEYS.map(key => queryClient.invalidateQueries({ queryKey: [key] })));
}

// Shared across mounted cards/screens; retain request IDs after uncertain
// failures and reloads. The server also deduplicates concurrent browser tabs.
const inFlight = new Map<string, Promise<CircleMembershipSnapshot>>();
export function requestCircleJoin(client: Pick<SupabaseClient, 'rpc'>, circleId: string, userId: string, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage) {
  const key = `circle-join:${userId}:${circleId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const request = (async () => {
    let requestId = storage.getItem(key);
    if (!requestId) { requestId = crypto.randomUUID(); storage.setItem(key, requestId); }
    const { data, error } = await client.rpc('join_circle' as any, { _circle_id: circleId, _request_id: requestId });
    if (error) throw error;
    const result = validateCircleSnapshot(data as unknown as CircleMembershipSnapshot, circleId, userId);
    storage.removeItem(key);
    return result;
  })();
  inFlight.set(key, request);
  void request.finally(() => { if (inFlight.get(key) === request) inFlight.delete(key); }).catch(() => {});
  return request;
}
