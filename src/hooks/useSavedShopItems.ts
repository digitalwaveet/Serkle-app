import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShopItem } from "@/types/shop";

export const useSavedShopItems = () => {
  return useQuery({
    queryKey: ['saved-shop-items'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: saves, error: savesError } = await supabase
        .from('shop_item_saves')
        .select(`
          item_id,
          shop_items (
            id,
            title,
            description,
            price,
            images,
            category,
            condition,
            location,
            stock,
            created_at,
            seller_id,
            profiles!shop_items_seller_id_fkey (
              id,
              name,
              username,
              avatar_url,
              is_verified
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (savesError) throw savesError;

      // Transform the data to match ShopItem interface
      const items: ShopItem[] = saves
        ?.filter(save => save.shop_items)
        .map(save => {
          const item = save.shop_items as any;
          const profile = item.profiles;
          
          return {
            id: item.id,
            title: item.title,
            name: item.title,
            description: item.description,
            price: item.price,
            originalPrice: item.original_price,
            image: item.images?.[0] || '',
            images: item.images || [],
            category: item.category,
            condition: item.condition,
            location: item.location,
            rating: 0,
            reviews: 0,
            seller: {
              id: profile.id,
              name: profile.name,
              avatar: profile.avatar_url || '',
              rating: 0,
              reviews: 0,
              followers: 0,
              following: false,
              verified: profile.is_verified || false,
            },
            likes: 0,
            shares: 0,
            comments: 0,
            liked: true,
            stock: item.stock,
            createdAt: item.created_at,
          } as ShopItem;
        }) || [];

      return items;
    },
  });
};
