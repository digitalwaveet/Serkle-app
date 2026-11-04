import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, ShippingAddress, PaymentMethod, Order } from '../types/cart';
import { ShopItem } from '../types/shop';

interface CartContextType {
  items: CartItem[];
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  currentOrder: Order | null;
  addToCart: (shopItem: ShopItem, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  openCart: () => void;
  closeCart: () => void;
  openCheckout: () => void;
  closeCheckout: () => void;
  createOrder: (shippingAddress: ShippingAddress, paymentMethod: PaymentMethod) => Order;
  setCurrentOrder: (order: Order | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('serkle_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('serkle_cart', JSON.stringify(items));
    } catch {
      // Silently fail if localStorage is full
    }
  }, [items]);

  const addToCart = (shopItem: ShopItem, quantity = 1) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.shopItemId === shopItem.id);
      
      if (existingItem) {
        return prevItems.map(item =>
          item.shopItemId === shopItem.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, shopItem.stock) }
            : item
        );
      }

      const newItem: CartItem = {
        id: Date.now().toString(),
        shopItemId: shopItem.id,
        title: shopItem.title,
        price: shopItem.price,
        originalPrice: shopItem.originalPrice,
        image: shopItem.images[0],
        seller: shopItem.seller,
        quantity,
        stock: shopItem.stock,
        category: shopItem.category,
      };

      return [...prevItems, newItem];
    });
  };

  const removeFromCart = (itemId: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, quantity: Math.min(quantity, item.stock) }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getCartTotal = () => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCartCount = () => {
    return items.reduce((count, item) => count + item.quantity, 0);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const openCheckout = () => setIsCheckoutOpen(true);
  const closeCheckout = () => setIsCheckoutOpen(false);

  const createOrder = (shippingAddress: ShippingAddress, paymentMethod: PaymentMethod): Order => {
    const subtotal = getCartTotal();
    const shipping = subtotal > 50 ? 0 : 9.99;
    const tax = subtotal * 0.08;
    const total = subtotal + shipping + tax;

    const order: Order = {
      id: `ORD-${Date.now()}`,
      items: [...items],
      shippingAddress,
      paymentMethod,
      subtotal,
      shipping,
      tax,
      total,
      status: 'pending',
      orderDate: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    return order;
  };

  const value: CartContextType = {
    items,
    isCartOpen,
    isCheckoutOpen,
    currentOrder,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
    openCart,
    closeCart,
    openCheckout,
    closeCheckout,
    createOrder,
    setCurrentOrder,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};