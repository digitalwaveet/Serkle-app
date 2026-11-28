import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { membershipQueryOptions } from '@/lib/circleMembershipClient';
import { type CircleFeature } from '@/lib/circleTypes';

export const CIRCLE_ACTIVITY_PERMISSIONS = [
  { id: 'publish_posts', label: 'Publish Feed posts', feature: 'posts' },
  { id: 'moderate_posts', label: 'Pin and remove Feed posts', feature: 'posts' },
  { id: 'videos', label: 'Manage videos and playlists', feature: 'videos' },
  { id: 'resources', label: 'Upload resources', feature: 'resources' },
  { id: 'events', label: 'Manage events and recordings', feature: 'events' },
  { id: 'services', label: 'Manage services and bookings', feature: 'services' },
  { id: 'messages', label: 'Manage the Circle messages inbox', feature: 'messages' },
  { id: 'analytics', label: 'View Circle analytics', feature: null },
  { id: 'settings', label: 'Edit Circle profile and settings', feature: null },
] as const satisfies readonly { id: string; label: string; feature: CircleFeature | null }[];

export type CircleActivityPermission = typeof CIRCLE_ACTIVITY_PERMISSIONS[number]['id'];

export function defaultCircleActivityPermission(permission: CircleActivityPermission): boolean {
  return permission !== 'settings';
}

export interface CircleAdminPermissions {
  can_invite_members: boolean;
  can_respond_to_requests: boolean;
  is_super_admin: boolean;
  activity_permissions: Partial<Record<CircleActivityPermission, boolean>>;
}

export interface CircleAdmin extends CircleAdminPermissions {
  user_id: string;
  name: string | null;
  username: string | null;
}

export type CircleAdminAction = 'invite' | 'requests' | 'remove' | 'super_admin' | CircleActivityPermission;

export async function listCircleAdmins(circleId: string): Promise<CircleAdmin[]> {
  const { data, error } = await supabase.rpc('list_circle_admins', { _circle_id: circleId });
  if (error) throw error;
  return (data ?? []) as unknown as CircleAdmin[];
}

export async function updateCircleAdmin(circleId: string, userId: string, action: CircleAdminAction, allowed?: boolean) {
  const { error } = await supabase.rpc('update_circle_admin', {
    _circle_id: circleId, _user_id: userId, _action: action, _allowed: allowed,
  });
  if (error) throw error;
}

export async function getMyCircleAdminPermissions(circleId: string): Promise<CircleAdminPermissions> {
  const { data, error } = await supabase.rpc('get_my_circle_admin_permissions', { _circle_id: circleId });
  if (error) throw error;
  return data as unknown as CircleAdminPermissions;
}

export function useMyCircleAdminPermissions(circleId?: string, userId?: string, isAdmin = false) {
  return useQuery({
    queryKey: ['circle-admin-permissions', circleId, userId],
    queryFn: () => getMyCircleAdminPermissions(circleId!),
    enabled: !!circleId && !!userId && isAdmin,
    ...membershipQueryOptions,
  });
}

export async function getCircleMemberInviteCode(circleId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_circle_member_invite_code', { _circle_id: circleId });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Invite link unavailable');
  return data;
}
