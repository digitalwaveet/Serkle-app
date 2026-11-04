import { circleMembershipFlags, type CircleMembershipInfo } from '@/lib/circleMembership';
import { CIRCLE_SELECT, fetchJoinedCircles, fetchOwnedCircles } from '@/lib/circleCollections';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeFeatures, type CircleFeature } from '@/lib/circleTypes';
import { fetchCircleMemberships, membershipQueryOptions } from '@/lib/circleMembershipClient';
import type { CircleMembershipSnapshot } from '@/lib/circleMembershipState';

export interface Circle {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  is_private: boolean;
  is_premium: boolean;
  is_expert: boolean;
  is_active: boolean;
  creator_id: string;
  created_at: string;
  circle_type: string;
  enabled_features: CircleFeature[];
  target_audience?: string | null;
  member_benefits?: string | null;
  primary_language?: string | null;
  is_online?: boolean;
  posting_policy?: string;
  about_text?: string | null;
  guidelines?: string[] | null;
  subscription_enabled?: boolean;
  subscription_price?: number;
  subscription_method?: string;
  members_count?: number;
  posts_count?: number;
  videos_count?: number;
  events_count?: number;
  resources_count?: number;
  services_count?: number;
  last_activity_at?: string | null;
  is_joined?: boolean;
  is_pending?: boolean;
  is_owned?: boolean;
  is_admin?: boolean;
  member_role?: string;
  membership_state?: CircleMembershipSnapshot;
  invite_code?: string;
  creator?: {
    name: string;
    avatar_url: string | null;
    username: string;
    /** Platform-confirmed creator verification â€” independent from premium status. */
    is_verified: boolean;
  };
}

/** Shared row â†’ Circle mapper so every hook formats circles identically. */
const mapCircleRow = (
  circle: any,
  userId: string | undefined,
  membership: CircleMembershipInfo,
  snapshot?: CircleMembershipSnapshot,
): Circle => ({
  id: circle.id,
  name: circle.name,
  description: circle.description,
  category: circle.category,
  location: circle.location,
  avatar_url: circle.avatar_url,
  cover_image_url: circle.cover_image_url,
  is_private: circle.is_private,
  is_premium: circle.is_premium,
  is_expert: circle.is_expert,
  is_active: circle.is_active,
  creator_id: snapshot?.creator_id || circle.creator_id,
  created_at: circle.created_at,
  // Fallbacks keep older rows (created before the circle-types migration) working
  circle_type: circle.circle_type ?? 'community',
  enabled_features: normalizeFeatures(circle.enabled_features),
  target_audience: circle.target_audience ?? null,
  member_benefits: circle.member_benefits ?? null,
  primary_language: circle.primary_language ?? null,
  is_online: circle.is_online ?? true,
  posting_policy: circle.posting_policy ?? 'creator',
  about_text: circle.about_text,
  guidelines: circle.guidelines,
  subscription_enabled: circle.subscription_enabled ?? false,
  subscription_price: circle.subscription_price ?? 10,
  subscription_method: circle.subscription_method ?? 'after_join',
  members_count: circle.circle_stats?.members_count || 0,
  posts_count: circle.circle_stats?.posts_count || 0,
  videos_count: circle.circle_stats?.videos_count || 0,
  events_count: circle.circle_stats?.events_count || 0,
  resources_count: circle.circle_stats?.resources_count || 0,
  services_count: circle.circle_stats?.services_count || 0,
  last_activity_at: circle.circle_stats?.last_activity_at ?? null,
  ...circleMembershipFlags(circle.creator_id, userId, membership),
  is_owned: snapshot?.state === 'owner',
  is_admin: snapshot?.state === 'owner' || snapshot?.state === 'manager',
  membership_state: snapshot,
  invite_code: circle.invite_code,
  creator: {
    name: circle.profiles?.name || 'Unknown',
    avatar_url: circle.profiles?.avatar_url || null,
    username: circle.profiles?.username || 'unknown',
    is_verified: circle.profiles?.is_verified ?? false,
  },
});

export const useCircles = (userId?: string) => {
  return useQuery({
    queryKey: ['circles', userId],
    queryFn: async () => {
      const { data: circles, error } = await supabase
        .from('circles')
        .select(CIRCLE_SELECT)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return mapCircleMemberships(circles || [], userId);
    },
    enabled: true,
    ...membershipQueryOptions,
  });
};

/**
 * Server-side circle search (ilike on name + description, backed by trigram
 * indexes). Kicks in from 2 characters; below that the client-side filter over
 * the browse list is enough.
 */
export const useSearchCircles = (query: string, userId?: string) => {
  // Strip characters that would break the PostgREST or() filter syntax
  const sanitized = query.trim().replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim();

  return useQuery({
    queryKey: ['circles-search', sanitized, userId],
    queryFn: async () => {
      const pattern = `%${sanitized}%`;
      const { data: circles, error } = await supabase
        .from('circles')
        .select(CIRCLE_SELECT)
        .eq('is_active', true)
        .or(`name.ilike.${pattern},description.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return mapCircleMemberships(circles || [], userId);
    },
    enabled: sanitized.length >= 2,
    ...membershipQueryOptions,
  });
};

export const useCircle = (circleId: string, userId?: string) => {
  return useQuery({
    queryKey: ['circle', circleId, userId],
    queryFn: async () => {
      const { data: circle, error } = await supabase
        .from('circles')
        .select(CIRCLE_SELECT)
        .eq('id', circleId)
        .single();

      if (error) throw error;

      return (await mapCircleMemberships([circle], userId))[0];
    },
    enabled: !!circleId,
    ...membershipQueryOptions,
  });
};

/** Every surface uses the backend's current membership and entitlement decision. */
async function mapCircleMemberships(rows: any[], userId?: string): Promise<Circle[]> {
  const snapshots = await fetchCircleMemberships(supabase, rows.map(row => row.id), userId);
  return rows.map(row => {
    const snapshot = snapshots.get(row.id)!;
    return mapCircleRow(row, userId, {
      is_joined: snapshot.status === 'active',
      is_pending: snapshot.status === 'pending',
      member_role: snapshot.role || null,
    }, snapshot);
  });
}

/** Joined contains active non-owner memberships, including admin memberships. */
export const useMyCircles = (userId: string) => useQuery({
  queryKey: ['my-circles', userId, 'non-owner-memberships'],
  queryFn: async () => mapCircleMemberships((await fetchJoinedCircles(supabase, userId)).map(row => row.circle), userId),
  enabled: !!userId,
  ...membershipQueryOptions,
});

/** Created is based on Circle ownership, never a management membership role. */
export const useOwnedCircles = (userId: string) => useQuery({
  queryKey: ['owned-circles', userId, 'creator-ownership'],
  queryFn: async () => mapCircleMemberships((await fetchOwnedCircles(supabase, userId)).map(row => row.circle), userId),
  enabled: !!userId,
  ...membershipQueryOptions,
});
