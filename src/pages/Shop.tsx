import React, { useState } from 'react';
import Header from '../components/Header';
import FooterNav from '../components/FooterNav';
import { ShopFeed } from '../components/shop/ShopFeed';
import { ShopSearch } from '../components/shop/ShopSearch';
import { ShopCategories } from '../components/shop/ShopCategories';
import { TrendingItemsCarousel } from '../components/shop/TrendingItemsCarousel';
import { FlashSalesSection } from '../components/shop/FlashSalesSection';
import { GroupBuysSection } from '../components/shop/GroupBuysSection';
import { InstallPrompt } from '../components/InstallPrompt';
import { CartModal } from '../components/shop/CartModal';
import { CheckoutModal } from '../components/shop/CheckoutModal';
import { OrderConfirmationModal } from '../components/shop/OrderConfirmationModal';
import { useCart } from '../contexts/CartContext';
import { ShoppingCart, Package, ShoppingBag, MessageSquare, MapPin, Heart, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useSellerProfile } from '../hooks/useSellerProfile';
import { useUser } from '../contexts/UserContext';

type TabKey = "home" | "circles" | "add" | "ask" | "safe" | "shop";

interface ShopProps {
  activeTab: TabKey;
  onTabSelect: (tab: TabKey) => void;
  onOpenCreate: () => void;
}

const Shop: React.FC<ShopProps> = ({ activeTab, onTabSelect, onOpenCreate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { openCart, getCartCount } = useCart();
  const navigate = useNavigate();
  const { user } = useUser();
  const { profile: sellerProfile } = useSellerProfile(user?.id);

  return (
    <div className="min-h-[100dvh] mx-auto bg-background text-foreground selection:bg-secondary/40 max-w-[480px] relative border-l border-r border-border/20 font-sans safe-area-bottom" data-testid="shop-page">
      <InstallPrompt />
      <div className="relative safe-area-top">
        <Header 
          onNotifications={() => navigate('/notifications')}
          onMessages={() => navigate('/messages')}
        />
        
        {/* Quick Action Bar */}
        <div className="flex gap-2 px-4 py-2 bg-muted/30 border-b overflow-x-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/orders')}
            className="flex-shrink-0"
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            My Orders
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/shop/messages')}
            className="flex-shrink-0"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/shipping-addresses')}
            className="flex-shrink-0"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Addresses
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/wishlist')}
            className="flex-shrink-0"
          >
            <Heart className="h-4 w-4 mr-2" />
            Wishlist
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/disputes')}
            className="flex-shrink-0"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Disputes
          </Button>
          {sellerProfile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/seller/dashboard')}
              className="flex-shrink-0"
            >
              <Package className="h-4 w-4 mr-2" />
              Seller Dashboard
            </Button>
          )}
        </div>
      </div>
      
      <main className="pb-28 safe-area-bottom">
        {/* Flash Sales Section */}
        <FlashSalesSection />
        
        {/* Group Buys Section */}
        <GroupBuysSection />
        
        <div className="mobile-px mobile-py space-y-4">
          <ShopSearch 
            value={searchQuery}
            onChange={setSearchQuery}
          />
          
          <ShopCategories 
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
        
        <div className="mobile-px">
          <TrendingItemsCarousel />
        </div>
        
        <ShopFeed 
          searchQuery={searchQuery}
          category={selectedCategory}
        />
      </main>

      {/* Floating Cart Button - Touch-optimized */}
      <Button
        onClick={openCart}
        className="fixed bottom-24 right-4 z-50 touch-target-large rounded-full shadow-elegant hover:shadow-glow transition-all duration-200 bg-primary hover:bg-primary/90 active:scale-95"
        size="icon"
      >
        <ShoppingCart className="h-6 w-6" />
        {getCartCount() > 0 && (
          <Badge className="absolute -top-1 -right-1 min-w-[1.5rem] h-6 flex items-center justify-center text-xs font-semibold bg-destructive text-destructive-foreground border-2 border-background">
            {getCartCount()}
          </Badge>
        )}
      </Button>
      
      <FooterNav
        active={activeTab}
        onSelect={onTabSelect}
        onOpenCreate={onOpenCreate}
      />
      
      {/* Modals */}
      <CartModal />
      <CheckoutModal />
      <OrderConfirmationModal />
    </div>
  );
};

export default Shop;