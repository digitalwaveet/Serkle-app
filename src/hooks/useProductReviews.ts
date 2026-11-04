import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProductReviews = (itemId: string) => {
  return useQuery({
    queryKey: ['product-reviews', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`
          *,
          user:profiles(
            id,
            name,
            avatar_url,
            is_verified
          )
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data?.map(review => ({
        id: review.id,
        user: {
          name: review.user?.name || 'Anonymous',
          avatar: review.user?.avatar_url || '',
          verified: review.user?.is_verified || false
        },
        rating: review.rating,
        comment: review.comment,
        timestamp: new Date(review.created_at).toLocaleDateString(),
        helpful: review.helpful_count,
        images: review.images || []
      })) || [];
    }
  });
};
