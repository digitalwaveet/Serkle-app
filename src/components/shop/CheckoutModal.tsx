import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useCart } from '../../contexts/CartContext';
import { useOrderMutations } from '../../hooks/useOrderMutations';
import { ShippingAddress, PaymentMethod } from '../../types/cart';
import { CreditCard, Truck, DollarSign, ArrowLeft, Coins } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { isShopPaymentType, SHOP_COIN_PAYMENTS_UNAVAILABLE } from '@/lib/shopPayments';

type CheckoutStep = 'shipping' | 'payment' | 'review';

export const CheckoutModal: React.FC = () => {
  const {
    items,
    isCheckoutOpen,
    closeCheckout,
    getCartTotal,
    createOrder: createLocalOrder,
    setCurrentOrder,
    clearCart,
  } = useCart();

  const { createOrder } = useOrderMutations();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    phone: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>({
    id: 'card-1',
    type: 'card',
    cardNumber: '',
    expiryDate: '',
    holderName: '',
    isDefault: true,
  });

  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentMethod['type']>('card');

  const validatePaymentType = () => {
    if (isShopPaymentType(selectedPaymentType)) return true;
    toast({ title: SHOP_COIN_PAYMENTS_UNAVAILABLE, variant: 'destructive' });
    return false;
  };

  const subtotal = getCartTotal();
  const shipping = subtotal > 50 ? 0 : 9.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const handleShippingSubmit = () => {
    if (!shippingAddress.fullName || !shippingAddress.street || !shippingAddress.city || !shippingAddress.zipCode) {
      toast({
        title: "Missing information",
        description: "Please fill in all required shipping fields",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep('payment');
  };

  const handlePaymentSubmit = () => {
    if (!validatePaymentType()) return;
    if (selectedPaymentType === 'card') {
      if (!paymentMethod.cardNumber || !paymentMethod.expiryDate || !paymentMethod.holderName) {
        toast({
          title: "Missing information",
          description: "Please fill in all payment fields",
          variant: "destructive",
        });
        return;
      }
    }
    setCurrentStep('review');
  };

  const handlePlaceOrder = async () => {
    if (!validatePaymentType()) return;
    setIsProcessing(true);
    
    try {
      // Process order
      const order = await createOrder.mutateAsync({
        items,
        shippingAddress,
        paymentMethod: { ...paymentMethod, type: selectedPaymentType },
        subtotal,
        shipping,
        tax,
        total
      });

      // Create local order record
      const localOrder = createLocalOrder(shippingAddress, { ...paymentMethod, type: selectedPaymentType });
      setCurrentOrder(localOrder);
      clearCart();
      closeCheckout();
      setCurrentStep('shipping');
    } catch (error) {
      console.error('Order processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderShippingStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            value={shippingAddress.fullName}
            onChange={(e) => setShippingAddress({ ...shippingAddress, fullName: e.target.value })}
            placeholder="John Doe"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={shippingAddress.phone}
            onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="street">Street Address *</Label>
        <Input
          id="street"
          value={shippingAddress.street}
          onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })}
          placeholder="123 Main St"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={shippingAddress.city}
            onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
            placeholder="New York"
          />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={shippingAddress.state}
            onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
            placeholder="NY"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="zipCode">ZIP Code *</Label>
          <Input
            id="zipCode"
            value={shippingAddress.zipCode}
            onChange={(e) => setShippingAddress({ ...shippingAddress, zipCode: e.target.value })}
            placeholder="10001"
          />
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={shippingAddress.country}
            onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
            placeholder="United States"
          />
        </div>
      </div>
      
      <Button onClick={handleShippingSubmit} className="w-full">
        Continue to Payment
      </Button>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-4">
      <div>
        <Label>Payment Method</Label>
        <RadioGroup value={selectedPaymentType} onValueChange={value => {
          if (isShopPaymentType(value)) setSelectedPaymentType(value);
        }}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="card" id="card" />
            <label htmlFor="card" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Credit/Debit Card
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="paypal" id="paypal" />
            <label htmlFor="paypal">PayPal</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="apple_pay" id="apple_pay" />
            <label htmlFor="apple_pay">Apple Pay</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="google_pay" id="google_pay" />
            <label htmlFor="google_pay">Google Pay</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="coins" id="coins" disabled aria-describedby="shop-coins-unavailable" />
            <label htmlFor="coins" className="flex items-center gap-2 text-muted-foreground">
              <Coins className="h-4 w-4 text-yellow-500" />
              Pay with Coins
            </label>
          </div>
        </RadioGroup>
        <p id="shop-coins-unavailable" className="mt-2 text-sm text-muted-foreground">{SHOP_COIN_PAYMENTS_UNAVAILABLE}</p>
      </div>

      {selectedPaymentType === 'card' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              value={paymentMethod.cardNumber}
              onChange={(e) => setPaymentMethod({ ...paymentMethod, cardNumber: e.target.value })}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                value={paymentMethod.expiryDate}
                onChange={(e) => setPaymentMethod({ ...paymentMethod, expiryDate: e.target.value })}
                placeholder="MM/YY"
                maxLength={5}
              />
            </div>
            <div>
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                placeholder="123"
                maxLength={4}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="holderName">Cardholder Name</Label>
            <Input
              id="holderName"
              value={paymentMethod.holderName}
              onChange={(e) => setPaymentMethod({ ...paymentMethod, holderName: e.target.value })}
              placeholder="John Doe"
            />
          </div>
        </div>
      )}

      {selectedPaymentType !== 'card' && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              You will be redirected to {selectedPaymentType === 'paypal' ? 'PayPal' : selectedPaymentType === 'apple_pay' ? 'Apple Pay' : 'Google Pay'} to complete your payment.
            </p>
          </CardContent>
        </Card>
      )}
      
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setCurrentStep('shipping')} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={handlePaymentSubmit} className="flex-1">
          Review Order
        </Button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4">
      {/* Shipping Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>{shippingAddress.fullName}</p>
          <p>{shippingAddress.street}</p>
          <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}</p>
          <p>{shippingAddress.country}</p>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {selectedPaymentType === 'card' ? (
            <p>**** **** **** {paymentMethod.cardNumber?.slice(-4)}</p>
          ) : (
            <p>{selectedPaymentType === 'paypal' ? 'PayPal' : selectedPaymentType === 'apple_pay' ? 'Apple Pay' : 'Google Pay'}</p>
          )}
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal ({items.length} items)</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setCurrentStep('payment')} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handlePlaceOrder} 
          className="flex-1"
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Place Order'}
        </Button>
      </div>
    </div>
  );

  const stepTitles = {
    shipping: 'Shipping Information',
    payment: 'Payment Method',
    review: 'Review Order',
  };

  return (
    <Dialog open={isCheckoutOpen} onOpenChange={closeCheckout}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{stepTitles[currentStep]}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {currentStep === 'shipping' && renderShippingStep()}
          {currentStep === 'payment' && renderPaymentStep()}
          {currentStep === 'review' && renderReviewStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
