import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreateReviewData {
  itemId: string;
  rating: number;
  comment: string;
  images?: string[];
}

export const useReviewMutations = () => {
  const queryClient = useQueryClient();

  const createReview = useMutation({
    mutationFn: async ({ itemId, rating, comment, images }: CreateReviewData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('product_reviews')
        .insert({
          item_id: itemId,
          user_id: user.id,
          rating,
          comment,
          images: images || [],
          order_id: null // Will be set when order system is implemented
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews', variables.itemId] });
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      toast({
        title: "Review submitted!",
        description: "Thank you for your feedback.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error submitting review",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markHelpful = useMutation({
    mutationFn: async (reviewId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert into review_helpful table (we need to create this)
      const { error } = await supabase
        .from('review_helpful')
        .insert({
          review_id: reviewId,
          user_id: user.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
      toast({
        title: "Marked as helpful",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    createReview,
    markHelpful
  };
};
