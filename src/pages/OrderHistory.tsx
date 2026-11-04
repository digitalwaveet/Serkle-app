import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CheckCircle, XCircle, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBuyerOrders } from '@/hooks/useBuyerOrders';
import { VideoLoader } from '@/components/ui/VideoLoader';
import FooterNav from '@/components/FooterNav';
import EmptyState from '@/components/ui/empty-state';
import { format } from 'date-fns';

const OrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const { data: orders, isLoading } = useBuyerOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4" />;
      case 'shipped':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'processing':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'shipped':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'delivered':
        return 'bg-success/10 text-success border-success/20';
      case 'cancelled':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.some(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTab = activeTab === 'all' || order.status === activeTab;
    
    return matchesSearch && matchesTab;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <VideoLoader size="md" />
      </div>
    );
  }

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
            <h1 className="text-lg font-semibold">Order History</h1>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 pt-4">
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
          <TabsTrigger value="shipped" className="text-xs">Shipped</TabsTrigger>
          <TabsTrigger value="delivered" className="text-xs">Delivered</TabsTrigger>
          <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-3">
          {!filteredOrders || filteredOrders.length === 0 ? (
            <EmptyState
              title="No Orders Found"
              description={searchQuery ? 'Try adjusting your search.' : "You haven't placed any orders yet."}
              actionLabel={searchQuery ? undefined : 'Start Shopping'}
              onAction={searchQuery ? undefined : () => navigate('/shop')}
            />
          ) : (
            filteredOrders.map((order) => (
              <Card
                key={order.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/order/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm mb-1">#{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </Badge>
                  </div>

                  {/* Order Items Preview */}
                  <div className="space-y-2 mb-3">
                    {order.items.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-12 h-12 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity} × ${item.price_at_purchase}
                          </p>
                        </div>
                      </div>
                    ))}
                    {order.items.length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{order.items.length - 2} more items
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-lg font-bold text-primary">${order.total}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <FooterNav active="shop" onSelect={() => {}} onOpenCreate={() => {}} />
    </div>
  );
};

export default OrderHistory;
