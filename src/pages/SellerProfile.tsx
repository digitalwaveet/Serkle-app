import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MessageCircle, Shield, MapPin, Calendar, TrendingUp, Package, DollarSign, Users, Phone, Mail, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import FooterNav from '@/components/FooterNav';
import { useSellerProfile } from '@/hooks/useSellerProfile';
import { useShopItems } from '@/hooks/useShopItems';
import { useUser } from '@/contexts/UserContext';
import { SellerOnboardingModal } from '@/components/shop/SellerOnboardingModal';

// Mock seller data that matches the shop items
const mockSellers = {
  'seller1': {
    id: 'seller1',
    name: 'TechGuru Store',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    verified: true,
    rating: 4.8,
    totalReviews: 234,
    joinedDate: '2022-03-15',
    location: 'San Francisco, CA',
    description: 'Premium electronics retailer specializing in latest gadgets and accessories. We pride ourselves on quality products and excellent customer service.',
    phone: '+1 (555) 123-4567',
    email: 'contact@techgurustore.com',
    stats: {
      totalSales: 15420,
      revenue: 847500,
      activeListings: 156,
      followers: 15420,
      responseRate: 98,
      responseTime: '< 2 hours'
    },
    badges: ['Top Seller', 'Fast Shipping', 'Verified Business']
  },
  'seller2': {
    id: 'seller2',
    name: 'Fashion Forward',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b17c?w=150&h=150&fit=crop&crop=face',
    verified: false,
    rating: 4.6,
    totalReviews: 145,
    joinedDate: '2021-08-20',
    location: 'New York, NY',
    description: 'Curated fashion collection featuring both vintage finds and contemporary pieces.',
    phone: '+1 (555) 987-6543',
    email: 'hello@fashionforward.com',
    stats: {
      totalSales: 8930,
      revenue: 234800,
      activeListings: 89,
      followers: 8930,
      responseRate: 95,
      responseTime: '< 4 hours'
    },
    badges: ['Fashion Expert', 'Eco Friendly']
  },
  'seller3': {
    id: 'seller3',
    name: 'Green Living Co',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    verified: true,
    rating: 4.9,
    totalReviews: 187,
    joinedDate: '2023-01-10',
    location: 'Seattle, WA',
    description: 'Sustainable living products and smart home solutions for eco-conscious consumers.',
    phone: '+1 (555) 456-7890',
    email: 'info@greenlivingco.com',
    stats: {
      totalSales: 12340,
      revenue: 456700,
      activeListings: 67,
      followers: 12340,
      responseRate: 99,
      responseTime: '< 1 hour'
    },
    badges: ['Eco Certified', 'Smart Home Expert']
  }
};

interface Review {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  rating: number;
  comment: string;
  timestamp: string;
  product: string;
}

const mockSellerReviews: Review[] = [
  {
    id: '1',
    user: {
      name: 'Sarah Johnson',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face'
    },
    rating: 5,
    comment: 'Excellent seller! Fast shipping and great communication. Product exactly as described.',
    timestamp: '2 days ago',
    product: 'iPhone 15 Pro'
  },
  {
    id: '2',
    user: {
      name: 'Mike Chen',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'
    },
    rating: 5,
    comment: 'Professional service and high-quality products. Highly recommend this seller!',
    timestamp: '1 week ago',
    product: 'MacBook Pro'
  },
  {
    id: '3',
    user: {
      name: 'Emma Wilson',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face'
    },
    rating: 4,
    comment: 'Good experience overall. Item arrived quickly and in good condition.',
    timestamp: '2 weeks ago',
    product: 'AirPods Pro'
  }
];

const SellerProfile: React.FC = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('listings');
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { profile, isLoading } = useSellerProfile(sellerId);

  const isOwnProfile = user?.id === sellerId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold">Seller Profile</h1>
            <div className="w-10" />
          </div>
        </div>
        <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading profile" showText /></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Seller Profile Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {isOwnProfile ? "You haven't set up your seller profile yet. Set up your profile to start selling on the platform." : "This seller profile doesn't exist."}
          </p>
          {isOwnProfile && (
            <>
              <Button onClick={() => setShowOnboarding(true)}>
                Set Up Seller Profile
              </Button>
              <SellerOnboardingModal 
                isOpen={showOnboarding} 
                onClose={() => setShowOnboarding(false)} 
              />
            </>
          )}
          {!isOwnProfile && (
            <Button onClick={() => navigate('/shop')}>Back to Shop</Button>
          )}
        </div>
      </div>
    );
  }

  const stats = (profile as any)?.stats || null;

  const rating = (profile as any)?.stats?.rating || 0;
  const totalReviews = (profile as any)?.stats?.reviews_count || 0;
  const createdAt = (profile as any)?.joined_date || Date.now();
  const sellerItems = (profile as any)?.items || [];

  const renderStars = (rating: number, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">Seller Profile</h1>
          {isOwnProfile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnboarding(true)}
              className="p-2"
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
          {!isOwnProfile && <div className="w-10" />}
        </div>
      </div>

      {/* Seller Onboarding Modal for editing */}
      {isOwnProfile && (
        <SellerOnboardingModal 
          isOpen={showOnboarding} 
          onClose={() => setShowOnboarding(false)}
          existingProfile={profile}
        />
      )}

      {/* Seller Header */}
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-4">
          <Avatar className="w-20 h-20">
            <AvatarFallback>{profile.business_name?.[0] || 'S'}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-bold text-lg truncate">{profile.business_name || 'Seller'}</h2>
              {profile.verification_status === 'verified' && (
                <Badge variant="outline" className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
              {profile.seller_type === 'shop' && (
                <Badge variant="secondary" className="text-xs">
                  Business
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              {renderStars(rating, 'sm')}
              <span className="text-sm text-muted-foreground">
                {rating.toFixed(1)} ({formatNumber((stats as any)?.followers_count || 0)} followers)
              </span>
            </div>
            
            {profile.location && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <MapPin className="w-3 h-3" />
                <span>{profile.location}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>Joined {new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <div className="flex gap-2">
            <Button className="flex-1">
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
            {profile.phone && (
              <Button variant="outline" className="flex-1">
                <Phone className="w-4 h-4 mr-2" />
                Call
              </Button>
            )}
          </div>
        )}

        {/* Verification Status */}
        {profile.seller_type === 'shop' && (
          <div className="flex flex-wrap gap-2">
            {profile.verification_status === 'verified' && (
              <Badge variant="default" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />
                Verified Business
              </Badge>
            )}
            {profile.verification_status === 'pending' && (
              <Badge variant="secondary" className="text-xs">
                Verification Pending
              </Badge>
            )}
            {profile.verification_status === 'rejected' && (
              <Badge variant="destructive" className="text-xs">
                Verification Rejected
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <DollarSign className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold">${formatNumber((profile as any)?.total_revenue || 0)}</div>
              <div className="text-xs text-muted-foreground">Total Revenue</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 text-center">
              <Package className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold">{formatNumber((profile as any)?.total_sales || 0)}</div>
              <div className="text-xs text-muted-foreground">Items Sold</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 text-center">
              <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold">{(stats as any)?.active_listings || 0}</div>
              <div className="text-xs text-muted-foreground">Active Listings</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 text-center">
              <Users className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold">{formatNumber((stats as any)?.followers_count || 0)}</div>
              <div className="text-xs text-muted-foreground">Followers</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>
          
          <TabsContent value="listings" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Active Listings ({sellerItems.length || 0})</h3>
              {isOwnProfile && (
                <Button size="sm" onClick={() => navigate('/create/shop')}>
                  Add Item
                </Button>
              )}
            </div>
            
            {sellerItems && sellerItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {sellerItems.map((item) => (
                  <Card 
                    key={item.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/shop/product/${item.id}`)}
                  >
                    <CardContent className="p-2">
                      <div className="aspect-square bg-muted rounded-lg mb-2 overflow-hidden relative">
                        <img 
                          src={item.images?.[0] || '/placeholder.svg'} 
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                        {item.stock === 0 && (
                          <Badge 
                            variant="destructive" 
                            className="absolute top-2 right-2 text-[10px] font-bold"
                          >
                            SOLD
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-xs line-clamp-2 mb-1 leading-tight">
                        {item.title}
                      </h4>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-primary">${item.price}</span>
                        <Badge variant={'default'} className="text-[10px]">
                          {item.condition}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No active listings</p>
                {isOwnProfile && (
                  <Button size="sm" className="mt-4" onClick={() => navigate('/create/shop')}>
                    Create First Listing
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="about" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">About the Seller</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.description && (
                  <>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {profile.description}
                    </p>
                    <Separator />
                  </>
                )}
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    {profile.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        <span>{profile.email}</span>
                      </div>
                    )}
                    {profile.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-primary" />
                        <span>{profile.phone}</span>
                      </div>
                    )}
                    {profile.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span>{profile.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Performance Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Response Rate:</span>
                      <span className="font-medium">{(profile as any)?.response_rate || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Response Time:</span>
                      <span className="font-medium">{(profile as any)?.avg_response_time ? `${(profile as any).avg_response_time}` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Sales:</span>
                      <span className="font-medium">{formatNumber((profile as any)?.total_sales || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Listings:</span>
                      <span className="font-medium">{(stats as any)?.active_listings || 0}</span>
                    </div>
                  </div>
                </div>

                {profile.seller_type === 'shop' && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm">Business Information</h4>
                      <div className="space-y-2 text-sm">
                        {profile.business_registration_number && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Registration Number:</span>
                            <span className="font-medium">{profile.business_registration_number}</span>
                          </div>
                        )}
                        {profile.tax_id && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax ID:</span>
                            <span className="font-medium">{profile.tax_id}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Verification Status:</span>
                          <Badge variant={
                            profile.verification_status === 'verified' ? 'default' :
                            profile.verification_status === 'pending' ? 'secondary' : 'destructive'
                          } className="text-xs">
                            {profile.verification_status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="reviews" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Customer Reviews</h3>
              <div className="flex items-center gap-1">
                {renderStars(rating, 'sm')}
                <span className="text-sm text-muted-foreground ml-1">
                  {rating.toFixed(1)} ({formatNumber(totalReviews)})
                </span>
              </div>
            </div>
            
            <div className="text-center py-8 text-muted-foreground">
              <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No reviews yet</p>
              <p className="text-xs mt-1">Reviews will appear here once customers rate this seller</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <FooterNav 
        active="home"
        onSelect={() => {}}
        onOpenCreate={() => {}}
      />
    </div>
  );
};

export default SellerProfile;