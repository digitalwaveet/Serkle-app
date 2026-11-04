import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type QuestionFilter = 'recent' | 'trending' | 'unanswered' | 'expert';

export const useQuestions = (filter: QuestionFilter = 'recent', page = 0, pageSize = 10, searchQuery?: string, categoryFilter?: string) => {
  return useQuery({
    queryKey: ['questions', filter, page, searchQuery, categoryFilter],
    queryFn: async () => {
      const sb = supabase as any;
      
      // Get questions with answer counts and thread updates
      let query = sb
        .from('questions')
        .select(`
          *,
          answers(id, user_id, is_helpful),
          vote_count:question_votes(count),
          thread_updates(id, created_at)
        `)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Search filter
      if (searchQuery) {
        query = query.or(`question.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`);
      }

      // Category filter
      if (categoryFilter && categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      // Apply filters
      switch (filter) {
        case 'recent':
          query = query.order('created_at', { ascending: false });
          break;
        case 'trending':
          query = query.order('views', { ascending: false });
          break;
        case 'unanswered':
          query = query.order('created_at', { ascending: false });
          break;
        case 'expert':
          query = query.order('created_at', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch expert user IDs
      const { data: expertData } = await sb
        .from('expert_profiles')
        .select('user_id')
        .eq('is_verified', true);
      
      const expertUserIds = new Set((expertData || []).map((e: any) => e.user_id));

      // Fetch profiles for expert users who posted questions
      const expertQuestionUserIds = (data || [])
        .filter((q: any) => q.user_id && expertUserIds.has(q.user_id))
        .map((q: any) => q.user_id);

      let expertProfiles: Record<string, any> = {};
      if (expertQuestionUserIds.length > 0) {
        const { data: profiles } = await sb
          .from('profiles')
          .select('id, username, name, avatar_url, initials, avatar_color')
          .in('id', expertQuestionUserIds);
        
        expertProfiles = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }
      
      // Process answer counts and thread update stats from the aggregated query
      const todayStr = new Date().toDateString();
      const processedData = data?.map((q: any) => {
        const updates = q.thread_updates || [];
        const threadUpdatesCount = updates.length;
        let latestUpdateDate: Date | null = null;
        if (updates.length > 0) {
          const sorted = [...updates].sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          latestUpdateDate = new Date(sorted[0].created_at);
        }
        const isUpdatedToday = latestUpdateDate ? (latestUpdateDate.toDateString() === todayStr) : false;

        const answersList = q.answers || [];
        const answerCount = answersList.length;
        const expertAnswerCount = answersList.filter((a: any) => expertUserIds.has(a.user_id)).length;
        const helpfulCount = (q.vote_count?.[0]?.count || 0) + answersList.filter((a: any) => a.is_helpful).length;

        return {
          ...q,
          answerCount,
          expertAnswerCount,
          helpfulCount,
          voteCount: q.vote_count?.[0]?.count || 0,
          isExpert: q.user_id ? expertUserIds.has(q.user_id) : false,
          expertProfile: q.user_id ? expertProfiles[q.user_id] || null : null,
          threadUpdatesCount,
          latestUpdateDate: latestUpdateDate ? latestUpdateDate.toISOString() : null,
          isUpdatedToday,
          is_thread: q.is_thread || threadUpdatesCount > 0,
        };
      }) || [];

      // Filter unanswered questions
      if (filter === 'unanswered') {
        return processedData.filter((q: any) => q.answerCount === 0);
      }

      // Filter expert questions only
      if (filter === 'expert') {
        return processedData.filter((q: any) => q.isExpert);
      }

      return processedData;
    },
  });
};

export const useQuestion = (questionId: string) => {
  return useQuery({
    queryKey: ['question', questionId],
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (error) throw error;
      
      // Increment view count
      await (supabase as any)
        .from('questions')
        .update({ views: (data.views || 0) + 1 })
        .eq('id', questionId);

      return data;
    },
    enabled: !!questionId,
  });
};

export const useCreateQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (questionData: {
      question: string;
      category: string;
      tags: string[];
      isUrgent?: boolean;
      isThread?: boolean;
      threadTitle?: string;
      isAnonymous?: boolean;
      anonymousName?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const sb = supabase as any;
      let forceExpertIdentity = false;

      if (user?.id) {
        const { data: expert } = await sb
          .from('expert_profiles')
          .select('is_verified')
          .eq('user_id', user.id)
          .eq('is_verified', true)
          .maybeSingle();

        forceExpertIdentity = !!expert?.is_verified;
      }

      const { data, error } = await sb
        .from('questions')
        .insert({
          user_id: user?.id || null,
          question: questionData.question,
          category: questionData.category,
          tags: questionData.tags,
          is_anonymous: forceExpertIdentity ? false : (questionData.isAnonymous || !user),
          anonymous_name: forceExpertIdentity
            ? null
            : (questionData.anonymousName || (user ? null : 'Anonymous')),
          is_thread: questionData.isThread || false
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Question posted successfully!');
    },
    onError: (error) => {
      console.error('Error creating question:', error);
      toast.error('Failed to post question');
    },
  });
};

export const useGenerateDiscussionSummary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questionId,
      question,
      category,
      answers
    }: {
      questionId: string;
      question: string;
      category?: string;
      answers: Array<{ id: string; answer: string; isExpert?: boolean; isHelpful?: boolean; authorName?: string }>;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-ai-insight', {
        body: { questionId, question, category, answers }
      });
      if (error) throw error;
      return data?.summary;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['question', variables.questionId] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    }
  });
};

export const useQuestionVote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, hasVoted }: { questionId: string; hasVoted: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (hasVoted) {
        // Remove vote
        const { error } = await (supabase as any)
          .from('question_votes')
          .delete()
          .eq('question_id', questionId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Add vote
        const { error } = await (supabase as any)
          .from('question_votes')
          .insert({ question_id: questionId, user_id: user.id });

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['question', variables.questionId] });
      queryClient.invalidateQueries({ queryKey: ['userVotes'] });
    },
  });
};

export const useUpdateQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, question, category, tags }: { questionId: string; question: string; category: string; tags: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const sb = supabase as any;
      const { error } = await sb
        .from('questions')
        .update({ question, category, tags, updated_at: new Date().toISOString() })
        .eq('id', questionId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['question', variables.questionId] });
      toast.success('Ask updated successfully');
    },
    onError: (error) => {
      console.error('Error updating question:', error);
      toast.error('Failed to update ask');
    },
  });
};

export const useDeleteQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (questionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const sb = supabase as any;
      const { error } = await sb
        .from('questions')
        .delete()
        .eq('id', questionId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, questionId) => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.removeQueries({ queryKey: ['question', questionId] });
      toast.success('Ask deleted');
    },
    onError: (error) => {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete ask');
    },
  });
};

export const useUserVotes = () => {
  return useQuery({
    queryKey: ['userVotes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { questions: [], answers: [], threadUpdates: [] };

      const [questions, answers, threadUpdates] = await Promise.all([
        (supabase as any)
          .from('question_votes')
          .select('question_id')
          .eq('user_id', user.id),
        (supabase as any)
          .from('answer_votes')
          .select('answer_id')
          .eq('user_id', user.id),
        (supabase as any)
          .from('thread_update_votes')
          .select('thread_update_id')
          .eq('user_id', user.id),
      ]);

      return {
        questions: questions.data?.map(v => v.question_id) || [],
        answers: answers.data?.map(v => v.answer_id) || [],
        threadUpdates: threadUpdates.data?.map(v => v.thread_update_id) || [],
      };
    },
  });
};
