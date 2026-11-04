import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useExpertAnswers = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['expertAnswers', userId],
    queryFn: async () => {
      if (!userId) return [];
      const sb = supabase as any;

      const { data, error } = await sb
        .from('answers')
        .select('id, answer, question_id, is_helpful, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch question texts
      const questionIds = [...new Set(data.map((a: any) => a.question_id))];
      const { data: questions } = await sb
        .from('questions')
        .select('id, question')
        .in('id', questionIds);

      const qMap: Record<string, string> = {};
      (questions || []).forEach((q: any) => { qMap[q.id] = q.question; });

      return data.map((a: any) => ({
        ...a,
        question_text: qMap[a.question_id] || null,
      }));
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
};
