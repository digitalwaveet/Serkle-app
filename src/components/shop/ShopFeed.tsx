import React from 'react';
import { useShopItems } from '@/hooks/useShopItems';
import { useShopItemMutations } from '@/hooks/useShopItemMutations';
import { ShopPostCard } from './ShopPostCard';
import { useCart } from '../../contexts/CartContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { VideoLoader } from '@/components/ui/VideoLoader';

interface ShopFeedProps {
  searchQuery: string;
  category: string;
}

export const ShopFeed: React.FC<ShopFeedProps> = ({ searchQuery, category }) => {
  const { data: items = [], isLoading } = useShopItems({ searchQuery, category });
  const { toggleLike } = useShopItemMutations();
  const { addToCart, openCheckout } = useCart();
  const navigate = useNavigate();

  const handleLike = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    toggleLike.mutate({ itemId, isLiked: item.liked });
    toast.success(item.liked ? 'Removed from favorites' : 'Added to favorites');
  };

  const handleShare = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const shareData = {
      title: item.title,
      text: `Check out ${item.title} for $${item.price}!`,
      url: `${window.location.origin}/shop/product/${item.id}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleQuickBuy = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      addToCart(item);
      openCheckout();
      toast.success(`${item.title} added to cart`);
    }
  };

  const handleAddToCart = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      addToCart(item);
      toast.success(`${item.title} added to cart`);
    }
  };

  const handleFollowSeller = (sellerId: string) => {
    toast.info('Follow seller feature coming soon!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <VideoLoader size="md" />
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50 pb-32">
      {items.length === 0 ? (
        <div className="text-center py-12 mobile-px">
          <p className="text-muted-foreground text-base">No items found</p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="py-3">
            <ShopPostCard
              item={item}
              onLike={handleLike}
              onShare={handleShare}
              onQuickBuy={handleQuickBuy}
              onAddToCart={handleAddToCart}
              onFollowSeller={handleFollowSeller}
            />
          </div>
        ))
      )}
    </div>
  );
};
