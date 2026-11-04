import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useQuestionBookmarks = (userId?: string) => {
  return useQuery({
    queryKey: ['question-bookmarks', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('question_bookmarks')
        .select(`
          *,
          questions:question_id (
            id,
            question,
            category,
            tags,
            is_anonymous,
            anonymous_name,
            created_at,
            views,
            user_id,
            is_thread
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
};

export const useIsQuestionBookmarked = (questionId?: string, userId?: string) => {
  return useQuery({
    queryKey: ['question-bookmark-status', questionId, userId],
    queryFn: async () => {
      if (!questionId || !userId) return false;
      
      const { data, error } = await supabase
        .from('question_bookmarks')
        .select('id')
        .eq('user_id', userId)
        .eq('question_id', questionId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!questionId && !!userId,
  });
};

export const useToggleQuestionBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, userId, isBookmarked }: { 
      questionId: string; 
      userId: string;
      isBookmarked: boolean;
    }) => {
      if (isBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('question_bookmarks')
          .delete()
          .eq('user_id', userId)
          .eq('question_id', questionId);

        if (error) throw error;
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('question_bookmarks')
          .insert({
            user_id: userId,
            question_id: questionId,
          });

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['question-bookmarks', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['question-bookmark-status', variables.questionId, variables.userId] });
      toast.success(variables.isBookmarked ? 'Bookmark removed' : 'Question bookmarked');
    },
    onError: (error) => {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
    },
  });
};
