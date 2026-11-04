import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSellerProfile } from '@/hooks/useSellerProfile';
import { useSellerOrders } from '@/hooks/useSellerOrders';
import { TrendingUp, DollarSign, ShoppingBag, Star, Package, Clock } from 'lucide-react';


interface SellerAnalyticsProps {
  sellerId: string;
}

export const SellerAnalytics: React.FC<SellerAnalyticsProps> = ({ sellerId }) => {
  const { profile, isLoading: profileLoading } = useSellerProfile(sellerId);
  const { data: orders, isLoading: ordersLoading } = useSellerOrders();

  if (profileLoading || ordersLoading) {
    return (
      <div className="flex justify-center py-12">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
  const processingOrders = orders?.filter(o => o.status === 'processing').length || 0;
  const shippedOrders = orders?.filter(o => o.status === 'shipped').length || 0;
  const deliveredOrders = orders?.filter(o => o.status === 'delivered').length || 0;

  const stats = [
    {
      title: 'Total Revenue',
      value: `$${profile?.total_revenue?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Total Sales',
      value: profile?.total_sales || 0,
      icon: ShoppingBag,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Active Listings',
      value: profile?.activeListings || 0,
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Average Rating',
      value: profile?.rating?.toFixed(1) || '0.0',
      icon: Star,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  const orderStats = [
    { label: 'Pending', value: pendingOrders, color: 'text-yellow-500' },
    { label: 'Processing', value: processingOrders, color: 'text-blue-500' },
    { label: 'Shipped', value: shippedOrders, color: 'text-purple-500' },
    { label: 'Delivered', value: deliveredOrders, color: 'text-success' },
  ];

  return (
    <div className="space-y-4">
      {/* Performance Stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-full ${stat.bgColor} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-xs text-muted-foreground mb-1">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Order Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orderStats.map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Response Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Response Rate</span>
              <span className="text-lg font-bold">{profile?.response_rate || 100}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Response Time</span>
              <span className="text-lg font-bold">
                {profile?.avg_response_time ? '2h' : 'N/A'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
