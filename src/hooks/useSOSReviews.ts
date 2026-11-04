import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SOSReview {
  id: string;
  alert_id: string;
  helper_user_id: string;
  reviewer_user_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
}

export interface CreateReviewData {
  alert_id: string;
  helper_user_id: string;
  rating: number;
  review_text?: string;
}

export const useSOSReviews = (alertId?: string) => {
  const queryClient = useQueryClient();

  // Fetch reviews for a specific alert
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['sos-reviews', alertId],
    queryFn: async () => {
      if (!alertId) return [];

      const { data, error } = await supabase
        .from('sos_reviews')
        .select(`
          *,
          helper:profiles!sos_reviews_helper_user_id_fkey(
            username,
            name,
            avatar_url
          ),
          reviewer:profiles!sos_reviews_reviewer_user_id_fkey(
            username,
            name
          )
        `)
        .eq('alert_id', alertId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!alertId,
  });

  // Fetch reviews for a specific helper
  const fetchHelperReviews = (helperUserId: string) => {
    return useQuery({
      queryKey: ['helper-reviews', helperUserId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('sos_reviews')
          .select('*')
          .eq('helper_user_id', helperUserId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      },
    });
  };

  // Create a review
  const createReview = useMutation({
    mutationFn: async (reviewData: CreateReviewData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sos_reviews')
        .insert({
          ...reviewData,
          reviewer_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sos-reviews', data.alert_id] });
      queryClient.invalidateQueries({ queryKey: ['helper-reviews', data.helper_user_id] });
      queryClient.invalidateQueries({ queryKey: ['helper-profile', data.helper_user_id] });
      toast.success('Review submitted successfully!');
    },
    onError: (error: Error) => {
      console.error('Failed to submit review:', error);
      toast.error('Failed to submit review');
    },
  });

  return {
    reviews,
    isLoading,
    createReview,
    fetchHelperReviews,
  };
};
