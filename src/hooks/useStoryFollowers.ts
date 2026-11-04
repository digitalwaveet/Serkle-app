import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useStoryFollowersCount = (questionId?: string) => {
  return useQuery({
    queryKey: ['storyFollowersCount', questionId],
    queryFn: async () => {
      if (!questionId) return 0;
      const sb = supabase as any;
      const { count, error } = await sb
        .from('story_followers')
        .select('*', { count: 'exact', head: true })
        .eq('question_id', questionId);

      if (error) {
        console.warn('Error fetching story followers count:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!questionId,
  });
};

export const useIsStoryFollowed = (questionId?: string, userId?: string) => {
  return useQuery({
    queryKey: ['isStoryFollowed', questionId, userId],
    queryFn: async () => {
      if (!questionId || !userId) return false;
      const sb = supabase as any;
      const { data, error } = await sb
        .from('story_followers')
        .select('id')
        .eq('question_id', questionId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error checking story follow status:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!questionId && !!userId,
  });
};

export const useToggleStoryFollow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      questionId,
      userId,
      isFollowed,
    }: {
      questionId: string;
      userId: string;
      isFollowed: boolean;
    }) => {
      const sb = supabase as any;
      if (isFollowed) {
        const { error } = await sb
          .from('story_followers')
          .delete()
          .eq('question_id', questionId)
          .eq('user_id', userId);

        if (error) throw error;
        return { isFollowed: false };
      } else {
        const { error } = await sb
          .from('story_followers')
          .insert({
            question_id: questionId,
            user_id: userId,
          });

        if (error) throw error;
        return { isFollowed: true };
      }
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData(
        ['isStoryFollowed', variables.questionId, variables.userId],
        result.isFollowed
      );
      queryClient.invalidateQueries({ queryKey: ['isStoryFollowed', variables.questionId] });
      queryClient.invalidateQueries({ queryKey: ['storyFollowersCount', variables.questionId] });
      if (result.isFollowed) {
        toast.success("Following story! You'll be notified when the author adds an update.");
      } else {
        toast.info('Unfollowed story updates.');
      }
    },
    onError: (error: any) => {
      console.error('Error toggling story follow:', error);
      toast.error(error.message || 'Failed to update follow status');
    },
  });
};
