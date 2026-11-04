import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShopItem } from "@/types/shop";
import { useEffect } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UseShopItemsParams {
  category?: string;
  searchQuery?: string;
  sellerId?: string;
  limit?: number;
}

export const useShopItems = ({ category, searchQuery, sellerId, limit }: UseShopItemsParams = {}) => {
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel('shop-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shop_items'
        },
        () => {
          // Invalidate queries when shop items change
          queryClient.invalidateQueries({ queryKey: ['shop-items'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shop_item_stats'
        },
        () => {
          // Invalidate queries when item stats change
          queryClient.invalidateQueries({ queryKey: ['shop-items'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['shop-items', category, searchQuery, sellerId, limit],
    queryFn: async () => {
      let query = supabase
        .from('shop_items')
        .select(`
          *,
          stats:shop_item_stats(
            likes_count,
            comments_count,
            shares_count,
            saves_count
          ),
          flash_sale:flash_sales(
            sale_price,
            end_time,
            status
          )
        `)
        .eq('status', 'active')
        .gt('stock', 0)
        .order('created_at', { ascending: false });

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      if (sellerId) {
        query = query.eq('seller_id', sellerId);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Check if user has liked/saved items
      const { data: { user } } = await supabase.auth.getUser();
      
      let userLikes: Set<string> = new Set();
      let userSaves: Set<string> = new Set();

      if (user) {
        const [likesRes, savesRes] = await Promise.all([
          supabase.from('shop_item_likes').select('item_id').eq('user_id', user.id),
          supabase.from('shop_item_saves').select('item_id').eq('user_id', user.id)
        ]);

        userLikes = new Set(likesRes.data?.map(l => l.item_id) || []);
        userSaves = new Set(savesRes.data?.map(s => s.item_id) || []);
      }

      // Transform to ShopItem type
      const items: ShopItem[] = await Promise.all((data || []).map(async item => {
        const stats = item.stats?.[0];
        const flashSale = item.flash_sale?.find(fs => fs.status === 'active');

        // Fetch seller profile separately
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('id, username, name, avatar_url')
          .eq('id', item.seller_id)
          .single();

        const { data: sellerInfo } = await supabase
          .from('seller_profiles')
          .select('business_name, verified')
          .eq('user_id', item.seller_id)
          .single();

        return {
          id: item.id,
          title: item.title,
          name: item.title,
          description: item.description || '',
          price: flashSale?.sale_price || item.price,
          originalPrice: flashSale ? item.price : item.original_price,
          image: item.images?.[0] || '',
          images: item.images || [],
          category: item.category,
          condition: item.condition as 'new' | 'used' | 'refurbished',
          brand: item.brand,
          location: item.location,
          rating: 0,
          reviews: 0,
          seller: {
            id: sellerProfile?.id || item.seller_id,
            name: sellerInfo?.business_name || sellerProfile?.name || 'Unknown Seller',
            avatar: sellerProfile?.avatar_url || '',
            rating: 0,
            reviews: 0,
            followers: 0,
            following: false,
            verified: sellerInfo?.verified || false
          },
          likes: stats?.likes_count || 0,
          shares: stats?.shares_count || 0,
          comments: stats?.comments_count || 0,
          liked: userLikes.has(item.id),
          stock: item.stock,
          flashSale: flashSale ? {
            endTime: flashSale.end_time,
            originalPrice: item.price
          } : undefined,
          createdAt: item.created_at
        };
      }));

      return items;
    }
  });
};
