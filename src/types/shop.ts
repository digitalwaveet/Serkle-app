export interface Seller {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviews: number;
  followers: number;
  following: boolean;
  verified: boolean;
}

export interface FlashSale {
  endTime: string;
  originalPrice: number;
}

export interface GroupBuy {
  minParticipants: number;
  currentParticipants: number;
  discountPercentage: number;
}

export interface ShopItem {
  id: string;
  title: string;
  name: string; // For compatibility
  description: string;
  price: number;
  originalPrice?: number;
  image: string; // For compatibility
  images: string[];
  category: string;
  condition: 'new' | 'used' | 'refurbished';
  brand?: string;
  location: string;
  rating: number;
  reviews: number;
  seller: Seller;
  likes: number;
  shares: number;
  comments: number;
  liked: boolean;
  stock: number;
  flashSale?: FlashSale;
  groupBuy?: GroupBuy;
  createdAt: string;
}