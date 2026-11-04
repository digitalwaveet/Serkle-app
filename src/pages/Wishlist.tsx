import Header from "@/components/Header";
import FooterNav from "@/components/FooterNav";
import { useSavedShopItems } from "@/hooks/useSavedShopItems";
import { VideoLoader } from '@/components/ui/VideoLoader';
import { useNavigate } from "react-router-dom";
import EmptyState from '@/components/ui/empty-state';

const Wishlist = () => {
  const { data: savedItems, isLoading } = useSavedShopItems();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <VideoLoader size="md" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />

      <div className="container mx-auto px-4 py-6">
        {!savedItems || savedItems.length === 0 ? (
          <EmptyState
            title="Your Wishlist Is Empty"
            description="Save items you love to your wishlist and they'll appear here."
            actionLabel="Browse Shop"
            onAction={() => navigate('/shop')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedItems.map((item) => (
              <div
                key={item.id}
                className="bg-card rounded-lg overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/shop/product/${item.id}`)}
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">${item.price}</span>
                    <span className="text-sm text-muted-foreground">{item.stock} left</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <FooterNav active="shop" onSelect={() => {}} onOpenCreate={() => {}} />
    </div>
  );
};

export default Wishlist;
