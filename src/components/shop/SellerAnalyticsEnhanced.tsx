import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useSellerOrders } from "@/hooks/useSellerOrders";
import { TrendingUp, Package, Star, DollarSign } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface SellerAnalyticsEnhancedProps {
  sellerId: string;
}

export const SellerAnalyticsEnhanced = ({ sellerId }: SellerAnalyticsEnhancedProps) => {
  const { profile, isLoading: profileLoading } = useSellerProfile(sellerId);
  const { data: orders, isLoading: ordersLoading } = useSellerOrders();

  if (profileLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  // Calculate revenue over time (last 7 days)
  const revenueData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayOrders = orders?.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate.toDateString() === date.toDateString();
    }) || [];
    const revenue = dayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: revenue,
    };
  });

  // Order status distribution
  const statusData = [
    { name: 'Pending', value: orders?.filter(o => o.status === 'pending').length || 0, color: 'hsl(var(--chart-1))' },
    { name: 'Processing', value: orders?.filter(o => o.status === 'processing').length || 0, color: 'hsl(var(--chart-2))' },
    { name: 'Shipped', value: orders?.filter(o => o.status === 'shipped').length || 0, color: 'hsl(var(--chart-3))' },
    { name: 'Delivered', value: orders?.filter(o => o.status === 'delivered').length || 0, color: 'hsl(var(--chart-4))' },
  ];

  // Category performance
  const categoryData = orders?.reduce((acc: any[], order) => {
    order.items?.forEach((item: any) => {
      const existing = acc.find(c => c.category === item.shop_items?.category);
      if (existing) {
        existing.sales += 1;
        existing.revenue += Number(item.price_at_purchase || 0) * item.quantity;
      } else {
        acc.push({
          category: item.shop_items?.category || 'Other',
          sales: 1,
          revenue: Number(item.price_at_purchase || 0) * item.quantity,
        });
      }
    });
    return acc;
  }, []) || [];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${profile?.total_revenue || 0}</div>
            <p className="text-xs text-muted-foreground">All time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.total_sales || 0}</div>
            <p className="text-xs text-muted-foreground">Orders completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profile?.stats?.rating?.toFixed(1) || '0.0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {profile?.stats?.reviews_count || 0} reviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profile?.stats?.active_listings || 0}
            </div>
            <p className="text-xs text-muted-foreground">Products listed</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
