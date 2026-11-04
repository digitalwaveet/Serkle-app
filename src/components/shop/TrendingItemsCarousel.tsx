import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from '@/components/ui/carousel';
import { Heart, Share2, ShoppingCart, TrendingUp } from 'lucide-react';
import { mockShopItems } from '@/data/shop';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export const TrendingItemsCarousel: React.FC = () => {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State for managing likes
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());

  // Get trending items (simulate trending logic)
  const trendingItems = mockShopItems
    .filter(item => item.likes > 50) // Items with high engagement
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 8); // Top 8 trending items

  const handleAddToCart = (item: typeof mockShopItems[0]) => {
    addToCart(item, 1);
  };

  const handleLike = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
        toast({
          description: "Removed from favorites",
        });
      } else {
        newSet.add(itemId);
        toast({
          description: "Added to favorites ❤️",
        });
      }
      return newSet;
    });
  };

  const handleShare = async (item: typeof mockShopItems[0], e: React.MouseEvent) => {
    e.stopPropagation();
    
    const shareData = {
      title: item.title,
      text: `Check out this amazing ${item.title} for $${item.price}!`,
      url: `${window.location.origin}/shop/product/${item.id}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast({
          description: "Shared successfully!",
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast({
          description: "Link copied to clipboard!",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        description: "Failed to share",
        variant: "destructive"
      });
    }
  };

  const handleItemClick = (itemId: string) => {
    navigate(`/shop/product/${itemId}`);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Trending Today</h2>
        <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5">Hot</Badge>
      </div>
      
      <Carousel
        opts={{
          align: "start",
          slidesToScroll: 1,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {trendingItems.map((item) => (
            <CarouselItem key={item.id} className="pl-2 basis-[140px]">
              <Card 
                className="cursor-pointer active:shadow-lg transition-all duration-200 border border-border/40 bg-card"
                onClick={() => handleItemClick(item.id)}
              >
                <CardContent className="p-2">
                  <div className="relative mb-2">
                    <div className="aspect-square rounded-lg overflow-hidden">
                      <img
                        src={item.images[0]}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {item.flashSale && (
                      <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-1">
                        Flash Sale
                      </Badge>
                    )}
                    <div className="absolute bottom-2 right-2 flex gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 w-7 p-0 rounded-full bg-background/90 hover:bg-background shadow-md backdrop-blur-sm touch-target active:scale-90 transition-transform"
                        onClick={(e) => handleLike(item.id, e)}
                      >
                        <Heart className={`h-3 w-3 ${likedItems.has(item.id) ? 'fill-red-500 text-red-500' : 'text-foreground'}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 w-7 p-0 rounded-full bg-background/90 hover:bg-background shadow-md backdrop-blur-sm touch-target active:scale-90 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(item);
                        }}
                      >
                        <ShoppingCart className="h-3 w-3 text-foreground" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-medium text-xs line-clamp-2 leading-tight min-h-[2rem]">
                      {item.title}
                    </h3>
                    
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-xs text-primary">
                          ${item.price}
                        </span>
                        {item.originalPrice && (
                          <span className="text-[10px] text-muted-foreground line-through">
                            ${item.originalPrice}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Heart className={`h-2.5 w-2.5 ${likedItems.has(item.id) ? 'fill-red-500 text-red-500' : 'fill-muted-foreground'}`} />
                        <span className="font-medium">{item.likes + (likedItems.has(item.id) ? 1 : 0)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};