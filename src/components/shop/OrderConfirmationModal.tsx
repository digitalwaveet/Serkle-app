import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useCart } from '../../contexts/CartContext';
import { CheckCircle, Package, Truck, Clock } from 'lucide-react';

export const OrderConfirmationModal: React.FC = () => {
  const { currentOrder, setCurrentOrder } = useCart();

  const handleClose = () => {
    setCurrentOrder(null);
  };

  if (!currentOrder) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'shipped':
        return <Truck className="h-4 w-4 text-blue-500" />;
      case 'delivered':
        return <Package className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={!!currentOrder} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            Order Confirmed!
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Order Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Order Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Order #{currentOrder.id}</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {getStatusIcon(currentOrder.status)}
                  {currentOrder.status.charAt(0).toUpperCase() + currentOrder.status.slice(1)}
                </Badge>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>Order Date: {formatDate(currentOrder.orderDate)}</p>
                <p>Estimated Delivery: {formatDate(currentOrder.estimatedDelivery)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentOrder.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} × ${item.price}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>{currentOrder.shippingAddress.fullName}</p>
              <p>{currentOrder.shippingAddress.street}</p>
              <p>
                {currentOrder.shippingAddress.city}, {currentOrder.shippingAddress.state} {currentOrder.shippingAddress.zipCode}
              </p>
              <p>{currentOrder.shippingAddress.country}</p>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${currentOrder.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{currentOrder.shipping === 0 ? 'Free' : `$${currentOrder.shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${currentOrder.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span>${currentOrder.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">What's Next?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Order confirmation email sent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span>Preparing your order</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-300 rounded-full" />
                <span>Shipping notification will be sent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-300 rounded-full" />
                <span>Track your package</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Continue Shopping
          </Button>
          <Button 
            onClick={() => {
              // Simulate order tracking
              alert(`Track your order #${currentOrder.id} at: tracking.example.com/${currentOrder.id}`);
            }}
            className="flex-1"
          >
            Track Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};