export interface CartItem {
  id: string;
  shopItemId: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: string;
  seller: {
    id: string;
    name: string;
    avatar: string;
  };
  quantity: number;
  stock: number;
  category: string;
}

export interface ShippingAddress {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  cardNumber?: string;
  expiryDate?: string;
  holderName?: string;
  isDefault: boolean;
}

export interface Order {
  id: string;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  orderDate: string;
  estimatedDelivery: string;
}