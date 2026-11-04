import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Heart, Share2, ShoppingCart, Zap, Clock, Users, MessageCircle } from 'lucide-react';
import { ShopItem } from '../../types/shop';
import { cn } from '../../lib/utils';

interface ShopPostCardProps {
  item: ShopItem;
  onLike: (itemId: string) => void;
  onShare: (itemId: string) => void;
  onQuickBuy: (itemId: string) => void;
  onAddToCart: (itemId: string) => void;
  onFollowSeller: (sellerId: string) => void;
}

export const ShopPostCard: React.FC<ShopPostCardProps> = ({
  item,
  onLike,
  onShare,
  onQuickBuy,
  onAddToCart,
  onFollowSeller
}) => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const handleCardClick = () => {
    navigate(`/shop/product/${item.id}`);
  };

  // Calculate time left for flash sales
  useEffect(() => {
    if (item.flashSale && item.flashSale.endTime) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const endTime = new Date(item.flashSale!.endTime).getTime();
        const difference = endTime - now;
        
        if (difference > 0) {
          setTimeLeft(Math.floor(difference / 1000));
        } else {
          setTimeLeft(0);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [item.flashSale]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const discountPercentage = item.originalPrice 
    ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
    : 0;

  return (
    <Card 
      className="overflow-hidden border border-border/50 shadow-soft active:shadow-md transition-all cursor-pointer bg-card"
      onClick={handleCardClick}
    >
      {/* Seller Header */}
      <div className="mobile-px py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-primary-foreground text-sm font-semibold">
              {item.seller.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{item.seller.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.seller.rating}★ • {item.seller.followers} followers
              </p>
            </div>
          </div>
          <Button
            variant={item.seller.following ? "secondary" : "outline"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onFollowSeller(item.seller.id);
            }}
            className="touch-target shrink-0 px-4"
          >
            {item.seller.following ? 'Following' : 'Follow'}
          </Button>
        </div>
      </div>

      {/* Product Image - Optimized for mobile */}
      <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
        <img 
          src={item.images[0]} 
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Flash Sale Timer */}
        {item.flashSale && timeLeft !== null && timeLeft > 0 && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-destructive text-destructive-foreground gap-1 px-2 py-0.5 text-xs">
              <Clock className="h-3 w-3" />
              <span className="font-semibold">{formatTime(timeLeft)}</span>
            </Badge>
          </div>
        )}
        
        {/* Discount Badge */}
        {discountPercentage > 0 && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-success text-success-foreground font-semibold px-2 py-0.5 text-xs">
              -{discountPercentage}%
            </Badge>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="mobile-px mobile-py space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-base leading-snug flex-1">{item.title}</h3>
          <div className="text-right shrink-0">
            <p className="font-bold text-lg text-primary">${item.price}</p>
            {item.originalPrice && (
              <p className="text-xs text-muted-foreground line-through">
                ${item.originalPrice}
              </p>
            )}
          </div>
        </div>
        
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
          {item.description}
        </p>

        {/* Category and Stock */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs px-2.5 py-1">
            {item.category}
          </Badge>
          {item.stock <= 5 && (
            <Badge variant="destructive" className="text-xs px-2.5 py-1 font-medium">
              Only {item.stock} left!
            </Badge>
          )}
        </div>

        {/* Social Actions - Touch optimized */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLike(item.id);
              }}
              className={cn(
                "flex items-center gap-1.5 text-sm transition-colors touch-target",
                item.liked ? "text-red-500" : "text-muted-foreground active:text-red-500"
              )}
            >
              <Heart className={cn("h-5 w-5", item.liked && "fill-current")} />
              <span className="font-medium">{item.likes}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(item.id);
              }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground active:text-foreground transition-colors touch-target"
            >
              <Share2 className="h-5 w-5" />
              <span className="font-medium">{item.shares}</span>
            </button>
            <button
              onClick={handleCardClick}
              className="flex items-center gap-1.5 text-sm text-muted-foreground active:text-foreground transition-colors cursor-pointer touch-target"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">{item.comments}</span>
            </button>
          </div>
          
          {item.groupBuy && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="font-medium">{item.groupBuy.currentParticipants}/{item.groupBuy.minParticipants}</span>
            </div>
          )}
        </div>

        {/* Action Buttons - Touch optimized */}
        <div className="flex gap-2.5 pt-1">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(item.id);
            }}
            variant="outline"
            className="flex-1 touch-target active:scale-95 transition-transform"
            size="default"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            <span className="font-medium">Add to Cart</span>
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onQuickBuy(item.id);
            }}
            className="flex-1 touch-target active:scale-95 transition-transform"
            size="default"
          >
            <Zap className="h-4 w-4 mr-2" />
            <span className="font-medium">Buy Now</span>
          </Button>
        </div>

        {/* Group Buy Progress */}
        {item.groupBuy && (
          <div className="p-3 bg-accent/30 rounded-xl border border-accent">
            <div className="flex justify-between text-xs mb-2">
              <span className="font-medium">Group Buy Progress</span>
              <span className="font-semibold text-primary">{item.groupBuy.currentParticipants}/{item.groupBuy.minParticipants}</span>
            </div>
            <div className="w-full bg-background rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${(item.groupBuy.currentParticipants / item.groupBuy.minParticipants) * 100}%` 
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-medium text-foreground">{item.groupBuy.minParticipants - item.groupBuy.currentParticipants}</span> more needed for group discount!
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};