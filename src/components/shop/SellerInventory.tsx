import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useShopItems } from '@/hooks/useShopItems';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { useShopItemMutations } from '@/hooks/useShopItemMutations';
import { toast } from 'sonner';

interface SellerInventoryProps {
  sellerId: string;
}

export const SellerInventory: React.FC<SellerInventoryProps> = ({ sellerId }) => {
  const navigate = useNavigate();
  const { data: items, isLoading } = useShopItems({ sellerId });
  const { deleteItem } = useShopItemMutations();

  const handleDelete = async (itemId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem.mutateAsync(itemId);
      } catch (error) {
        // Error handled by mutation
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No Products Listed</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Start selling by adding your first product
          </p>
          <Button onClick={() => navigate('/create/shop')}>
            Add Product
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </p>
        <Button size="sm" onClick={() => navigate('/create/shop')}>
          Add Product
        </Button>
      </div>

      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <img
                src={item.images[0]}
                alt={item.title}
                className="w-20 h-20 rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm mb-1 truncate">{item.title}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {item.category}
                  </Badge>
                  <Badge 
                    variant={item.stock > 5 ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    Stock: {item.stock}
                  </Badge>
                </div>
                <p className="text-lg font-bold text-primary">${item.price}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/shop/product/${item.id}`)}
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/shop/edit/${item.id}`)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(item.id)}
                disabled={deleteItem.isPending}
              >
                {deleteItem.isPending ? (
                  <SerkleLoader size="xs" className="text-current" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
