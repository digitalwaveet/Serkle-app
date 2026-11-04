import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useCart } from '../../contexts/CartContext';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { toast } from '../ui/use-toast';

export const CartModal: React.FC = () => {
  const {
    items,
    isCartOpen,
    closeCart,
    removeFromCart,
    updateQuantity,
    getCartTotal,
    getCartCount,
    openCheckout,
    clearCart,
  } = useCart();

  const handleCheckout = () => {
    if (items.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Add some items to your cart first",
        variant: "destructive",
      });
      return;
    }
    closeCart();
    openCheckout();
  };

  const subtotal = getCartTotal();
  const shipping = subtotal > 50 ? 0 : 9.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  return (
    <Dialog open={isCartOpen} onOpenChange={closeCart}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90dvh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShoppingBag className="h-6 w-6" />
            Shopping Cart ({getCartCount()})
          </DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
            <ShoppingBag className="h-20 w-20 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground mb-6 text-base">Add some items to get started</p>
            <Button onClick={closeCart} size="lg" className="touch-target">
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto scroll-optimized px-6 py-4">
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 border border-border/50 rounded-xl bg-card">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-20 h-20 object-cover rounded-lg shrink-0"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-base line-clamp-2 mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{item.seller.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-primary">${item.price}</span>
                        {item.originalPrice && (
                          <span className="text-sm text-muted-foreground line-through">
                            ${item.originalPrice}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="h-8 w-8 p-0 hover:bg-background active:scale-90 transition-transform"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          
                          <span className="text-base font-semibold min-w-[2rem] text-center">
                            {item.quantity}
                          </span>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="h-8 w-8 p-0 hover:bg-background active:scale-90 transition-transform"
                            disabled={item.quantity >= item.stock}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.id)}
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive active:scale-90 transition-all"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t bg-muted/30 px-6 py-4">
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-xl border-t border-border pt-3">
                  <span>Total</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
                
                {subtotal < 50 && (
                  <Badge variant="secondary" className="w-full justify-center py-2 text-sm font-medium">
                    Add ${(50 - subtotal).toFixed(2)} more for free shipping
                  </Badge>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={clearCart}
                  className="flex-1 touch-target active:scale-95 transition-transform"
                  size="lg"
                >
                  Clear Cart
                </Button>
                <Button
                  onClick={handleCheckout}
                  className="flex-1 touch-target active:scale-95 transition-transform"
                  size="lg"
                >
                  Checkout
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};