import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, CreditCard, Truck, CheckCircle, AlertTriangle } from 'lucide-react';
import { DisputeModal } from '@/components/shop/DisputeModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useBuyerOrders } from '@/hooks/useBuyerOrders';

import FooterNav from '@/components/FooterNav';
import { format } from 'date-fns';

const OrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data: orders, isLoading } = useBuyerOrders();
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);

  const order = orders?.find(o => o.id === orderId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
            <Button onClick={() => navigate('/orders')}>
              View All Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Order Placed', icon: Package, color: 'text-yellow-500' };
      case 'processing':
        return { label: 'Processing', icon: Package, color: 'text-blue-500' };
      case 'shipped':
        return { label: 'Shipped', icon: Truck, color: 'text-purple-500' };
      case 'delivered':
        return { label: 'Delivered', icon: CheckCircle, color: 'text-success' };
      default:
        return { label: status, icon: Package, color: 'text-muted-foreground' };
    }
  };

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/orders')}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Order Details</h1>
              <p className="text-xs text-muted-foreground">#{order.order_number}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ${statusInfo.color}`}>
                <StatusIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">{statusInfo.label}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(order.updated_at), 'MMM dd, yyyy • hh:mm a')}
                </p>
              </div>
            </div>
            {order.status === 'shipped' && (
              <p className="text-sm text-muted-foreground">
                Estimated delivery: {format(new Date(order.estimated_delivery), 'MMM dd, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items.map((item, index) => (
              <div key={item.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex gap-3">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-20 h-20 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Sold by {item.seller_name}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                      </span>
                      <span className="font-semibold">
                        ${(item.price_at_purchase * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>${order.shipping_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>${order.tax.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">${order.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          {order.status !== 'delivered' && (
            <Button
              variant="outline"
              onClick={() => setDisputeModalOpen(true)}
              className="w-full"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Open a Dispute
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/shop')}>
              Continue Shopping
            </Button>
            {order.status === 'delivered' && (
              <Button className="flex-1" onClick={() => navigate(`/shop/product/${order.items[0]?.id}`)}>
                Review Products
              </Button>
            )}
          </div>
        </div>
      </div>

      <DisputeModal
        open={disputeModalOpen}
        onOpenChange={setDisputeModalOpen}
        orderId={order.id}
        sellerId={order.items?.[0]?.seller_id || ''}
      />

      <FooterNav active="shop" onSelect={() => {}} onOpenCreate={() => {}} />
    </div>
  );
};

export default OrderDetail;
