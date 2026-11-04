import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUserQuestions = (userId?: string) => {
  return useQuery({
    queryKey: ['user-questions', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          answer_count:answers(count),
          vote_count:question_votes(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.map((q: any) => ({
        ...q,
        answerCount: q.answer_count?.[0]?.count || 0,
        upvotes: q.vote_count?.[0]?.count || 0,
      }));
    },
    enabled: !!userId,
  });
};

export const useUserAnswers = (userId?: string) => {
  return useQuery({
    queryKey: ['user-answers', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('answers')
        .select(`
          *,
          questions!inner(
            id,
            question,
            category,
            is_anonymous,
            anonymous_name
          ),
          vote_count:answer_votes(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.map((a: any) => ({
        ...a,
        upvotes: a.vote_count?.[0]?.count || 0,
      }));
    },
    enabled: !!userId,
  });
};

export const useAskStatistics = (userId?: string) => {
  return useQuery({
    queryKey: ['ask-statistics', userId],
    queryFn: async () => {
      if (!userId) return {
        questionsAsked: 0,
        answersGiven: 0,
        helpfulAnswers: 0,
        totalUpvotes: 0,
      };
      
      // Get questions count
      const { count: questionsCount } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get answers count
      const { count: answersCount } = await supabase
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get helpful answers count
      const { count: helpfulCount } = await supabase
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_helpful', true);

      // Get total upvotes from answers
      const { data: answerVotes } = await supabase
        .from('answers')
        .select(`
          id,
          vote_count:answer_votes(count)
        `)
        .eq('user_id', userId);

      const totalUpvotes = answerVotes?.reduce((sum, answer: any) => {
        return sum + (answer.vote_count?.[0]?.count || 0);
      }, 0) || 0;

      return {
        questionsAsked: questionsCount || 0,
        answersGiven: answersCount || 0,
        helpfulAnswers: helpfulCount || 0,
        totalUpvotes,
      };
    },
    enabled: !!userId,
  });
};
