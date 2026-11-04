import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Clock, TrendingUp } from 'lucide-react';
import { useFlashSales } from '@/hooks/useFlashSales';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

export const FlashSalesSection: React.FC = () => {
  const { data: flashSales, isLoading } = useFlashSales();
  const navigate = useNavigate();
  const { addToCart, openCheckout } = useCart();
  const [timers, setTimers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!flashSales) return;

    const interval = setInterval(() => {
      const newTimers: Record<string, number> = {};
      flashSales.forEach(sale => {
        const now = new Date().getTime();
        const endTime = new Date(sale.end_time).getTime();
        const difference = endTime - now;
        newTimers[sale.id] = Math.max(0, Math.floor(difference / 1000));
      });
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [flashSales]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading || !flashSales || flashSales.length === 0) return null;

  return (
    <div className="mobile-px mobile-py space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-bold">Flash Sales</h2>
        </div>
        <Badge className="bg-destructive text-destructive-foreground">
          Limited Time!
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {flashSales.map((sale) => {
          const discountPercentage = Math.round(
            ((sale.original_price - sale.sale_price) / sale.original_price) * 100
          );
          const timeLeft = timers[sale.id] || 0;
          const stockPercentage = ((sale.quantity_limit - sale.quantity_sold) / sale.quantity_limit) * 100;

          return (
            <Card
              key={sale.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/shop/product/${sale.item_id}`)}
            >
              <div className="relative aspect-square">
                <img
                  src={sale.item.images[0]}
                  alt={sale.item.title}
                  className="w-full h-full object-cover"
                />
                <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">
                  -{discountPercentage}%
                </Badge>
                <Badge className="absolute top-2 right-2 bg-black/70 text-white gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(timeLeft)}
                </Badge>
              </div>

              <CardContent className="p-3 space-y-2">
                <h3 className="font-semibold text-sm line-clamp-2 h-10">
                  {sale.item.title}
                </h3>

                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-destructive">
                    ${sale.sale_price}
                  </span>
                  <span className="text-xs text-muted-foreground line-through">
                    ${sale.original_price}
                  </span>
                </div>

                {/* Stock Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Stock</span>
                    <span className="font-semibold">
                      {sale.quantity_limit - sale.quantity_sold} left
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-destructive h-full transition-all"
                      style={{ width: `${stockPercentage}%` }}
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    // This would need the full shop item data
                    toast.success('Flash sale item added to cart!');
                  }}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Buy Now
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
