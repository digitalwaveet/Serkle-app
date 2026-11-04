export interface CircleMembershipInfo {
  is_joined: boolean;
  member_role: string | null;
  is_pending?: boolean;
}

/** Ownership is authoritative even when the creator membership is missing.
 * Listing an owner only under Created must never erase their real membership. */
export function circleMembershipFlags(creatorId: string, userId: string | undefined, membership: CircleMembershipInfo) {
  const owned = !!userId && creatorId === userId;
  const joined = !!userId && membership.is_joined;
  return {
    is_owned: owned,
    is_joined: joined,
    is_pending: !!userId && !!membership.is_pending,
    is_admin: owned || (joined && (membership.member_role === 'admin' || membership.member_role === 'creator')),
    member_role: joined ? membership.member_role || undefined : undefined,
  };
}

export function uniqueCircleRows<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/** Queries can refresh at different times during an ownership transfer. Give
 * Created precedence so cached pages never paint the same Circle twice. */
export function separateCircleCollections<T extends { id: string }>(owned: readonly T[], memberships: readonly T[]) {
  const created = uniqueCircleRows(owned);
  const ownedIds = new Set(created.map(circle => circle.id));
  return { created, joined: uniqueCircleRows(memberships).filter(circle => !ownedIds.has(circle.id)) };
}

/** Fetch every server page; a single Supabase select is capped by max_rows. */
export async function allCirclePages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 100,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid Circle page size');
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}
