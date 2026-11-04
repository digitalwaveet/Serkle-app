import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadShopItemImages, deleteShopItemImage } from "@/utils/shopImageUpload";

interface CreateShopItemData {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  condition: 'new' | 'used' | 'refurbished';
  brand?: string;
  location: string;
  stock: number;
  images: File[];
}

interface UpdateShopItemData extends Partial<CreateShopItemData> {
  id: string;
  newImages?: File[];
  removedImages?: string[];
}

export const useShopItemMutations = () => {
  const queryClient = useQueryClient();

  const createItem = useMutation({
    mutationFn: async (data: CreateShopItemData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload images
      const imageUrls = await uploadShopItemImages(data.images, user.id);

      // Create shop item
      const { data: item, error } = await supabase
        .from('shop_items')
        .insert({
          seller_id: user.id,
          title: data.title,
          description: data.description,
          price: data.price,
          original_price: data.originalPrice,
          category: data.category,
          condition: data.condition,
          brand: data.brand,
          location: data.location,
          stock: data.stock,
          images: imageUrls,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      toast.success('Item listed successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create listing: ${error.message}`);
    }
  });

  const updateItem = useMutation({
    mutationFn: async (data: UpdateShopItemData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { id, newImages, removedImages, images, ...updateData } = data;

      // Handle image updates
      let finalImages: string[] | undefined;
      
      if (removedImages || newImages) {
        // Get current images
        const { data: currentItem } = await supabase
          .from('shop_items')
          .select('images')
          .eq('id', id)
          .single();

        let imageUrls = currentItem?.images || [];

        // Remove deleted images
        if (removedImages) {
          await Promise.all(removedImages.map(url => deleteShopItemImage(url)));
          imageUrls = imageUrls.filter(url => !removedImages.includes(url));
        }

        // Upload new images
        if (newImages?.length) {
          const newUrls = await uploadShopItemImages(newImages, user.id);
          imageUrls = [...imageUrls, ...newUrls];
        }

        finalImages = imageUrls;
      }

      // Update item
      const { data: item, error } = await supabase
        .from('shop_items')
        .update({
          ...updateData,
          ...(finalImages && { images: finalImages }),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('seller_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      toast.success('Item updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update item: ${error.message}`);
    }
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get item images to delete
      const { data: item } = await supabase
        .from('shop_items')
        .select('images')
        .eq('id', itemId)
        .single();

      // Delete images from storage
      if (item?.images) {
        await Promise.all(item.images.map(url => deleteShopItemImage(url).catch(() => {})));
      }

      // Delete item
      const { error } = await supabase
        .from('shop_items')
        .delete()
        .eq('id', itemId)
        .eq('seller_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      toast.success('Item deleted successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete item: ${error.message}`);
    }
  });

  const toggleLike = useMutation({
    mutationFn: async ({ itemId, isLiked }: { itemId: string; isLiked: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (isLiked) {
        const { error } = await supabase
          .from('shop_item_likes')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shop_item_likes')
          .insert({ item_id: itemId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update like: ${error.message}`);
    }
  });

  const toggleSave = useMutation({
    mutationFn: async ({ itemId, isSaved }: { itemId: string; isSaved: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (isSaved) {
        const { error } = await supabase
          .from('shop_item_saves')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shop_item_saves')
          .insert({ item_id: itemId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save item: ${error.message}`);
    }
  });

  return {
    createItem,
    updateItem,
    deleteItem,
    toggleLike,
    toggleSave
  };
};
