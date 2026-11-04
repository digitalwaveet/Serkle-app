import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, TrendingUp, DollarSign, Star, Eye, MessageSquare, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useSellerOrders } from '@/hooks/useSellerOrders';
import { useSellerProfile } from '@/hooks/useSellerProfile';
import { useUser } from '@/contexts/UserContext';

import FooterNav from '@/components/FooterNav';
import { SellerOrdersList } from '@/components/shop/SellerOrdersList';
import { useNavigation } from '@/contexts/NavigationContext';
import { SellerInventory } from '@/components/shop/SellerInventory';
import { SellerAnalyticsEnhanced } from '@/components/shop/SellerAnalyticsEnhanced';
import { SellerVerificationModal } from '@/components/shop/SellerVerificationModal';
import { CheckCircle2, Clock } from 'lucide-react';

const SellerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { profile, isLoading: profileLoading } = useSellerProfile(user?.id);
  const { data: orders, isLoading: ordersLoading } = useSellerOrders();
  const { pushModalState } = useNavigation();
  const [activeTab, setActiveTab] = useState('orders');
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);

  const handleOpenVerification = () => {
    pushModalState('seller-verification', () => setVerificationModalOpen(false));
    setVerificationModalOpen(true);
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Not a Seller Yet</h2>
            <p className="text-muted-foreground mb-4">
              You need to set up your seller profile first
            </p>
            <Button onClick={() => navigate('/create/shop')}>
              Become a Seller
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = {
    totalSales: profile.total_sales || 0,
    totalRevenue: profile.total_revenue || 0,
    activeListings: profile.activeListings || 0,
    rating: profile.rating || 0,
  };

  const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
  const processingOrders = orders?.filter(o => o.status === 'processing').length || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/shop')}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Seller Dashboard</h1>
              <p className="text-xs text-muted-foreground">{profile.business_name || 'My Store'}</p>
            </div>
          </div>
          <Button
            variant={profile?.verification_status === 'verified' ? 'default' : 'outline'}
            size="sm"
            onClick={handleOpenVerification}
          >
            {profile?.verification_status === 'verified' ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Verified
              </>
            ) : profile?.verification_status === 'pending' ? (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Pending
              </>
            ) : (
              'Get Verified'
            )}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-success" />
                <span className="text-xs text-muted-foreground">Revenue</span>
              </div>
              <p className="text-xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Sales</span>
              </div>
              <p className="text-xl font-bold">{stats.totalSales}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Active Items</span>
              </div>
              <p className="text-xl font-bold">{stats.activeListings}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Rating</span>
              </div>
              <p className="text-xl font-bold">{stats.rating.toFixed(1)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        {(pendingOrders > 0 || processingOrders > 0) && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold mb-1">Action Required</p>
                  <p className="text-sm text-muted-foreground">
                    {pendingOrders} pending, {processingOrders} processing
                  </p>
                </div>
                <Button size="sm" onClick={() => setActiveTab('orders')}>
                  View Orders
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="orders" className="text-xs">
            <Package className="w-4 h-4 mr-1" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs">
            <Eye className="w-4 h-4 mr-1" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs">
            <TrendingUp className="w-4 h-4 mr-1" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <SellerOrdersList orders={orders || []} isLoading={ordersLoading} />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <SellerInventory sellerId={user?.id || ''} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <SellerAnalyticsEnhanced sellerId={user?.id || ''} />
        </TabsContent>
      </Tabs>

      <SellerVerificationModal
        open={verificationModalOpen}
        onOpenChange={setVerificationModalOpen}
        currentStatus={profile?.verification_status}
      />

      <FooterNav active="shop" onSelect={() => {}} onOpenCreate={() => {}} />
    </div>
  );
};

export default SellerDashboard;
