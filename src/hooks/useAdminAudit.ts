import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export const useAdminAudit = () => {
  const logAction = async (
    action: string,
    targetType: string,
    targetId?: string,
    details?: Record<string, Json | undefined>
  ) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('Admin session unavailable');

      const { error } = await supabase.from('admin_audit_log').insert({
        admin_id: session.user.id,
        action,
        target_type: targetType,
        target_id: targetId || null,
        details: details || {},
      });
      if (error) throw error;
    } catch {
      toast.warning('Could not write this action to the audit log.');
    }
  };

  return { logAction };
};
