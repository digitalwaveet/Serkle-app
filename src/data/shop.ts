import { ShopItem } from '../types/shop';

export const mockShopItems: ShopItem[] = [
  {
    id: '1',
    title: 'Wireless Bluetooth Headphones',
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium quality wireless headphones with noise cancellation. Perfect for music lovers and professionals.',
    price: 89.99,
    originalPrice: 129.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop'],
    category: 'electronics',
    condition: 'new',
    brand: 'AudioTech',
    location: 'San Francisco, CA',
    rating: 4.8,
    reviews: 156,
    seller: {
      id: 'seller1',
      name: 'TechGuru Store',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      rating: 4.8,
      reviews: 234,
      followers: 15420,
      following: false,
      verified: true
    },
    likes: 234,
    shares: 45,
    comments: 78,
    liked: false,
    stock: 23,
    flashSale: {
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      originalPrice: 129.99
    },
    createdAt: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    title: 'Vintage Leather Jacket',
    name: 'Vintage Leather Jacket',
    description: 'Handcrafted genuine leather jacket with vintage styling. Made from premium quality materials.',
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop',
    images: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop'],
    category: 'fashion',
    condition: 'used',
    brand: 'Classic Leather',
    location: 'New York, NY',
    rating: 4.6,
    reviews: 89,
    seller: {
      id: 'seller2',
      name: 'Fashion Forward',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b17c?w=100&h=100&fit=crop&crop=face',
      rating: 4.6,
      reviews: 145,
      followers: 8930,
      following: true,
      verified: false
    },
    likes: 456,
    shares: 89,
    comments: 123,
    liked: true,
    stock: 7,
    groupBuy: {
      minParticipants: 10,
      currentParticipants: 6,
      discountPercentage: 15
    },
    createdAt: '2024-01-14T15:45:00Z'
  },
  {
    id: '3',
    title: 'Smart Plant Monitoring System',
    name: 'Smart Plant Monitoring System',
    description: 'Keep your plants healthy with this IoT-enabled monitoring system. Tracks moisture, light, and temperature.',
    price: 45.99,
    originalPrice: 59.99,
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop',
    images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop'],
    category: 'home',
    condition: 'new',
    brand: 'SmartGarden',
    location: 'Seattle, WA',
    rating: 4.9,
    reviews: 73,
    seller: {
      id: 'seller3',
      name: 'Green Living Co',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      rating: 4.9,
      reviews: 187,
      followers: 12340,
      following: false,
      verified: true
    },
    likes: 189,
    shares: 34,
    comments: 56,
    liked: false,
    stock: 15,
    createdAt: '2024-01-13T09:20:00Z'
  },
  {
    id: '4',
    title: 'Artisan Coffee Beans',
    name: 'Artisan Coffee Beans',
    description: 'Single-origin Ethiopian coffee beans, roasted to perfection. Notes of chocolate and citrus.',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop',
    images: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop'],
    category: 'food',
    condition: 'new',
    brand: 'Mountain Peak',
    location: 'Portland, OR',
    rating: 4.7,
    reviews: 92,
    seller: {
      id: 'seller4',
      name: 'Mountain Peak Roasters',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&crop=face',
      rating: 4.7,
      reviews: 156,
      followers: 5670,
      following: false,
      verified: false
    },
    likes: 312,
    shares: 67,
    comments: 45,
    liked: false,
    stock: 3,
    flashSale: {
      endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
      originalPrice: 29.99
    },
    createdAt: '2024-01-12T14:10:00Z'
  },
  {
    id: '5',
    title: 'Handmade Ceramic Vase',
    name: 'Handmade Ceramic Vase',
    description: 'Beautiful handcrafted ceramic vase with unique glaze pattern. Perfect for home decoration.',
    price: 35.00,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop',
    images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop'],
    category: 'art',
    condition: 'new',
    brand: 'Artisan Works',
    location: 'Austin, TX',
    rating: 4.8,
    reviews: 41,
    seller: {
      id: 'seller5',
      name: 'Pottery Studio',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
      rating: 4.8,
      reviews: 89,
      followers: 3450,
      following: true,
      verified: true
    },
    likes: 145,
    shares: 23,
    comments: 18,
    liked: true,
    stock: 1,
    groupBuy: {
      minParticipants: 5,
      currentParticipants: 3,
      discountPercentage: 10
    },
    createdAt: '2024-01-11T11:30:00Z'
  }
];