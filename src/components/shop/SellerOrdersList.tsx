import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Clock, Truck } from 'lucide-react';
import { SellerOrder } from '@/hooks/useSellerOrders';
import { useOrderStatusUpdate } from '@/hooks/useOrderStatusUpdate';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SellerOrdersListProps {
  orders: SellerOrder[];
  isLoading: boolean;
}

export const SellerOrdersList: React.FC<SellerOrdersListProps> = ({ orders, isLoading }) => {
  const { updateOrderStatus } = useOrderStatusUpdate();

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: newStatus });
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'processing':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'shipped':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'delivered':
        return 'bg-success/10 text-success border-success/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending':
        return { status: 'processing', label: 'Start Processing', icon: Clock };
      case 'processing':
        return { status: 'shipped', label: 'Mark as Shipped', icon: Truck };
      case 'shipped':
        return { status: 'delivered', label: 'Mark as Delivered', icon: Package };
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No Orders Yet</h3>
          <p className="text-sm text-muted-foreground">
            Orders from buyers will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const nextStatus = getNextStatus(order.status);
        const NextIcon = nextStatus?.icon;

        return (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm mb-1">#{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(order.created_at), 'MMM dd, yyyy • hh:mm a')}
                  </p>
                </div>
                <Badge className={getStatusColor(order.status)}>
                  {order.status}
                </Badge>
              </div>

              {/* Buyer Info */}
              <div className="flex items-center gap-3 mb-3 p-2 bg-muted/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
                  {order.buyer_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{order.buyer_name}</p>
                  <p className="text-xs text-muted-foreground">Buyer</p>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-2 mb-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity} × ${item.price_at_purchase}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t mb-3">
                <span className="text-sm text-muted-foreground">Order Total</span>
                <span className="text-lg font-bold text-primary">${order.total}</span>
              </div>

              {/* Action Buttons */}
              {nextStatus && (
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => handleStatusUpdate(order.id, nextStatus.status)}
                  disabled={updateOrderStatus.isPending}
                >
                  {updateOrderStatus.isPending ? (
                    <SerkleLoader size="xs" className="text-current mr-2" />
                  ) : NextIcon ? (
                    <NextIcon className="w-4 h-4 mr-2" />
                  ) : null}
                  {nextStatus.label}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
