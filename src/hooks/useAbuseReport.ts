import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AbuseReport {
  reported_user_id?: string;
  alert_id?: string;
  report_type: 'false_alert' | 'harassment' | 'inappropriate_content' | 'spam' | 'other';
  description: string;
}

export const useAbuseReport = () => {
  const queryClient = useQueryClient();

  const submitReport = useMutation({
    mutationFn: async (report: AbuseReport) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('abuse_reports')
        .insert({
          reporter_user_id: user.id,
          ...report,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Report submitted. We will review it shortly.');
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit report: ${error.message}`);
    },
  });

  return {
    submitReport,
  };
};
