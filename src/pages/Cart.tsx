import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/contexts/CartContext';
import FooterNav from '@/components/FooterNav';
import EmptyState from '@/components/ui/empty-state';

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { items, removeFromCart, updateQuantity, getCartTotal, clearCart, openCheckout } = useCart();

  const handleCheckout = () => {
    openCheckout();
    navigate('/shop');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-background max-w-[480px] mx-auto border-l border-r border-border/20">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
          <div className="flex items-center gap-3 p-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="touch-target"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Shopping Cart</h1>
          </div>
        </div>

        {/* Empty State */}
        <EmptyState
          title="Your Cart Is Empty"
          description="Add items to get started."
          actionLabel="Browse Shop"
          onAction={() => navigate('/shop')}
          className="min-h-[60vh] py-0"
        />

        <FooterNav active="shop" onSelect={() => {}} onOpenCreate={() => {}} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background max-w-[480px] mx-auto border-l border-r border-border/20 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="touch-target"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Shopping Cart</h1>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="text-destructive"
            >
              Clear All
            </Button>
          </div>
        </div>
      </div>

      {/* Cart Items */}
      <div className="p-4 space-y-4">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex gap-4">
              {/* Product Image */}
              <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Product Details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  ${item.price.toFixed(2)}
                </p>

                {/* Quantity Controls */}
                <div className="flex items-center gap-3 mt-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[2rem] text-center">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 ml-auto text-destructive"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Fixed Bottom Summary */}
      <div className="fixed bottom-16 left-0 right-0 bg-background border-t border-border/40 p-4 max-w-[480px] mx-auto">
        <div className="space-y-4">
          {/* Summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${getCartTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium">Free</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>${getCartTotal().toFixed(2)}</span>
            </div>
          </div>

          {/* Checkout Button */}
          <Button
            onClick={handleCheckout}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            Proceed to Checkout
          </Button>
        </div>
      </div>

      <FooterNav active="shop" onSelect={() => {}} onOpenCreate={() => {}} />
    </div>
  );
};

export default Cart;
