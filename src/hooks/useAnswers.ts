import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAnswers = (questionId: string) => {
  return useQuery({
    queryKey: ['answers', questionId],
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from('answers')
        .select('*')
        .eq('question_id', questionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately for non-null user_ids
      const userIds = data
        ?.filter((a: any) => a.user_id)
        .map((a: any) => a.user_id) || [];

      let profiles: any = {};
      let expertUserIds = new Set<string>();
      let expertDetails: Record<string, any> = {};
      if (userIds.length > 0) {
        const [profileRes, expertRes] = await Promise.all([
          sb.from('profiles')
            .select('id, username, name, avatar_url, initials, avatar_color')
            .in('id', userIds),
          sb.from('expert_profiles')
            .select('user_id, specialty, years_experience, bio, certifications')
            .eq('is_verified', true)
            .in('user_id', userIds),
        ]);

        profiles = (profileRes.data || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        expertUserIds = new Set((expertRes.data || []).map((e: any) => e.user_id));
        
        expertDetails = (expertRes.data || []).reduce((acc: any, e: any) => {
          acc[e.user_id] = e;
          return acc;
        }, {});
      }

      const enrichedAnswers = data?.map((answer: any) => ({
        ...answer,
        profile: answer.user_id ? profiles[answer.user_id] : null,
        isExpert: answer.user_id ? expertUserIds.has(answer.user_id) : false,
        expertProfile: answer.user_id ? expertDetails[answer.user_id] || null : null,
      })) || [];

      // Multi-factor ranking algorithm
      return enrichedAnswers.sort((a: any, b: any) => {
        // Calculate Score for A
        let scoreA = 0;
        if (a.isExpert) scoreA += 1000;
        if (a.is_helpful) scoreA += 500; // Question author marked as helpful
        
        const helpfulA = a.helpful_count || 0;
        const totalA = a.total_feedback || 0;
        const ratioA = totalA > 0 ? (helpfulA / totalA) : 0;
        // Weight raw helpful votes and the ratio
        scoreA += (helpfulA * 10) + (ratioA * 50);

        // Recency decay for A (newer gets a slight boost)
        const ageADays = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24);
        scoreA += Math.max(0, 100 - ageADays);

        // Calculate Score for B
        let scoreB = 0;
        if (b.isExpert) scoreB += 1000;
        if (b.is_helpful) scoreB += 500;
        
        const helpfulB = b.helpful_count || 0;
        const totalB = b.total_feedback || 0;
        const ratioB = totalB > 0 ? (helpfulB / totalB) : 0;
        scoreB += (helpfulB * 10) + (ratioB * 50);

        const ageBDays = (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24);
        scoreB += Math.max(0, 100 - ageBDays);

        return scoreB - scoreA; // Descending
      });
    },
    enabled: !!questionId,
  });
};

export const useCreateAnswer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (answerData: {
      questionId: string;
      answer: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const sb = supabase as any;
      const { data, error } = await sb
        .from('answers')
        .insert({
          question_id: answerData.questionId,
          user_id: user.id,
          answer: answerData.answer,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['answers', variables.questionId] });
      queryClient.invalidateQueries({ queryKey: ['question', variables.questionId] });
      toast.success('Answer posted successfully!');
    },
    onError: (error) => {
      console.error('Error creating answer:', error);
      toast.error('Failed to post answer');
    },
  });
};

export const useAnswerVote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ answerId, hasVoted, questionId }: { answerId: string; hasVoted: boolean; questionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (hasVoted) {
        const { error } = await (supabase as any)
          .from('answer_votes')
          .delete()
          .eq('answer_id', answerId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('answer_votes')
          .insert({ answer_id: answerId, user_id: user.id });

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['answers', variables.questionId] });
      queryClient.invalidateQueries({ queryKey: ['userVotes'] });
    },
  });
};

export const useUpdateAnswer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ answerId, questionId, answer }: { answerId: string; questionId: string; answer: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const sb = supabase as any;
      const { error } = await sb
        .from('answers')
        .update({ answer, updated_at: new Date().toISOString() })
        .eq('id', answerId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['answers', variables.questionId] });
      toast.success('Comment updated successfully');
    },
    onError: (error) => {
      console.error('Error updating answer:', error);
      toast.error('Failed to update comment');
    },
  });
};

export const useDeleteAnswer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ answerId, questionId }: { answerId: string; questionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const sb = supabase as any;
      const { error } = await sb
        .from('answers')
        .delete()
        .eq('id', answerId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['answers', variables.questionId] });
      queryClient.invalidateQueries({ queryKey: ['question', variables.questionId] });
      toast.success('Comment deleted');
    },
    onError: (error) => {
      console.error('Error deleting answer:', error);
      toast.error('Failed to delete comment');
    },
  });
};

export const useMarkAnswerHelpful = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ answerId, questionId }: { answerId: string; questionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Verify user is the question author
      const sb = supabase as any;
      const { data: question } = await sb
        .from('questions')
        .select('user_id')
        .eq('id', questionId)
        .single();

      if (question?.user_id !== user.id) {
        throw new Error('Only the question author can mark answers as helpful');
      }

      const { error } = await sb
        .from('answers')
        .update({ is_helpful: true })
        .eq('id', answerId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['answers', variables.questionId] });
      toast.success('Answer marked as helpful!');
    },
    onError: (error) => {
      console.error('Error marking answer as helpful:', error);
      toast.error('Failed to mark answer as helpful');
    },
  });
};
