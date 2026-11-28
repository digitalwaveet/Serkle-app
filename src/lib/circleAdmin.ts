import { supabase } from '@/integrations/supabase/client';

export interface CircleAdminPermissions {
  can_invite_members: boolean;
  can_respond_to_requests: boolean;
}

export interface CircleAdmin extends CircleAdminPermissions {
  user_id: string;
  name: string | null;
  username: string | null;
}

export type CircleAdminAction = 'invite' | 'requests' | 'remove';

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

export async function getCircleMemberInviteCode(circleId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_circle_member_invite_code', { _circle_id: circleId });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Invite link unavailable');
  return data;
}
