import type { SupabaseClient } from '@supabase/supabase-js';
import { allCirclePages, uniqueCircleRows, type CircleMembershipInfo } from './circleMembership.ts';

export const CIRCLE_SELECT = `
  *,
  circle_stats (*),
  profiles!circles_creator_id_fkey (
    name, avatar_url, username, is_verified
  )
`;

type CircleClient = Pick<SupabaseClient, 'from'>;
export interface CircleCollectionRow {
  circle: any;
  membership: CircleMembershipInfo;
}

const membershipInfo = (member?: { status: string; role: string }): CircleMembershipInfo => ({
  is_joined: member?.status === 'active',
  is_pending: member?.status === 'pending',
  member_role: member?.status === 'active' ? member.role : null,
});

export async function fetchJoinedCircles(client: CircleClient, userId: string, pageSize = 100): Promise<CircleCollectionRow[]> {
  if (!userId) return [];
  // The inner join and ownership exclusion run BEFORE range pagination. Admin
  // and moderator memberships are still non-owner memberships, not ownership.
  const rows = await allCirclePages<any>((from, to) => client.from('circles')
    .select(`${CIRCLE_SELECT}, circle_members!inner(user_id, status, role)`)
    .eq('circle_members.user_id', userId)
    .eq('circle_members.status', 'active')
    .neq('creator_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to), pageSize);
  return uniqueCircleRows(rows).map(circle => ({
    circle,
    membership: membershipInfo(circle.circle_members?.find((member: any) => member.user_id === userId && member.status === 'active')),
  }));
}

export async function fetchOwnedCircles(client: CircleClient, userId: string, pageSize = 100): Promise<CircleCollectionRow[]> {
  if (!userId) return [];
  const [rows, memberships] = await Promise.all([
    allCirclePages<any>((from, to) => client.from('circles')
      .select(CIRCLE_SELECT)
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to), pageSize),
    allCirclePages<any>((from, to) => client.from('circle_members')
      .select('circle_id, status, role')
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .order('circle_id', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), pageSize),
  ]);
  return uniqueCircleRows(rows).map(circle => ({
    circle,
    membership: membershipInfo(memberships.find(member => member.circle_id === circle.id && member.status === 'active')
      || memberships.find(member => member.circle_id === circle.id)),
  }));
}
