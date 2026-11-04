import { supabase } from '@/integrations/supabase/client';

export const useAdminAudit = () => {
  const logAction = async (
    action: string,
    targetType: string,
    targetId?: string,
    details?: Record<string, any>
  ) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    await supabase.from('admin_audit_log').insert({
      admin_id: session.session.user.id,
      action,
      target_type: targetType,
      target_id: targetId || null,
      details: details || {},
    });
  };

  return { logAction };
};
