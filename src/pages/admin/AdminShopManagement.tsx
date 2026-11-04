import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Store, ShieldCheck, Package, TrendingUp, Search, CheckCircle, XCircle,
  Eye, DollarSign, AlertTriangle, ShoppingCart, Clock, Star,
} from 'lucide-react';

// ── Types ──
interface SellerProfile {
  user_id: string;
  business_name: string | null;
  email: string;
  location: string;
  seller_type: string;
  verification_status: string;
  verified: boolean;
  total_sales: number;
  total_revenue: number;
  joined_date: string;
  verification_submitted_at: string | null;
  profile?: { name: string; username: string; avatar_url: string | null; initials: string };
}

interface ShopItem {
  id: string;
  title: string;
  price: number;
  status: string;
  category: string;
  stock: number;
  created_at: string;
  seller_id: string;
  seller?: { name: string; username: string };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  buyer_id: string;
  buyer?: { name: string; username: string };
}

interface Dispute {
  id: string;
  reason: string;
  description: string;
  status: string;
  created_at: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  order?: { order_number: string; total: number };
}

// ── Helpers ──
const statusColor = (s: string) => {
  const map: Record<string, string> = {
    verified: 'bg-green-500/10 text-green-600', approved: 'bg-green-500/10 text-green-600',
    active: 'bg-green-500/10 text-green-600', delivered: 'bg-green-500/10 text-green-600',
    resolved: 'bg-green-500/10 text-green-600',
    pending: 'bg-yellow-500/10 text-yellow-600', processing: 'bg-yellow-500/10 text-yellow-600',
    under_review: 'bg-yellow-500/10 text-yellow-600',
    rejected: 'bg-destructive/10 text-destructive', suspended: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-destructive/10 text-destructive', open: 'bg-orange-500/10 text-orange-600',
  };
  return map[s] || 'bg-muted text-muted-foreground';
};

// ── Main Component ──
export default function AdminShopManagement() {
  const { logAction } = useAdminAudit();
  const [tab, setTab] = useState('sellers');
  const [search, setSearch] = useState('');

  // Sellers
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [sellerFilter, setSellerFilter] = useState('all');

  // Products
  const [products, setProducts] = useState<ShopItem[]>([]);
  const [productFilter, setProductFilter] = useState('all');

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState('all');

  // Disputes
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  // Stats
  const [stats, setStats] = useState({ sellers: 0, products: 0, orders: 0, disputes: 0, revenue: 0 });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = () => {
    fetchSellers(); fetchProducts(); fetchOrders(); fetchDisputes(); fetchStats();
  };

  const fetchSellers = async () => {
    const { data } = await supabase
      .from('seller_profiles')
      .select('*, profile:profiles!seller_profiles_user_id_fkey(name, username, avatar_url, initials)')
      .order('joined_date', { ascending: false });
    if (data) setSellers(data as any);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('shop_items')
      .select('*, seller:profiles!shop_items_seller_id_fkey(name, username)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setProducts(data as any);
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, buyer:profiles!orders_buyer_id_fkey(name, username)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setOrders(data as any);
  };

  const fetchDisputes = async () => {
    const { data } = await supabase
      .from('disputes')
      .select('*, order:orders!disputes_order_id_fkey(order_number, total)')
      .order('created_at', { ascending: false });
    if (data) setDisputes(data as any);
  };

  const fetchStats = async () => {
    const [s, p, o, d] = await Promise.all([
      supabase.from('seller_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('shop_items').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('total', { count: 'exact' }),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    ]);
    const revenue = (o.data || []).reduce((sum: number, r: any) => sum + (r.total || 0), 0);
    setStats({
      sellers: s.count || 0, products: p.count || 0,
      orders: o.count || 0, disputes: d.count || 0, revenue,
    });
  };

  // ── Actions ──
  const handleVerifySeller = async (seller: SellerProfile, status: 'verified' | 'rejected') => {
    const { error } = await supabase.from('seller_profiles')
      .update({ verification_status: status, verified: status === 'verified' })
      .eq('user_id', seller.user_id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await logAction(`seller_${status}`, 'seller', seller.user_id, { business: seller.business_name });
    toast({ title: `Seller ${status}` });
    fetchSellers();
  };

  const handleProductStatus = async (item: ShopItem, status: string) => {
    const { error } = await supabase.from('shop_items').update({ status }).eq('id', item.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await logAction(`product_${status}`, 'shop_item', item.id, { title: item.title });
    toast({ title: `Product ${status}` });
    fetchProducts();
  };

  const handleDisputeResolve = async (dispute: Dispute, resolution: string) => {
    const { error } = await supabase.from('disputes')
      .update({ status: 'resolved', resolution, resolved_at: new Date().toISOString() })
      .eq('id', dispute.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await logAction('dispute_resolved', 'dispute', dispute.id, { resolution });
    toast({ title: 'Dispute resolved' });
    fetchDisputes();
  };

  // ── Filters ──
  const filteredSellers = sellers.filter(s => {
    if (sellerFilter !== 'all' && s.verification_status !== sellerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.business_name || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
        || (s.profile?.name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const filteredProducts = products.filter(p => {
    if (productFilter !== 'all' && p.status !== productFilter) return false;
    if (search) return p.title.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const filteredOrders = orders.filter(o => {
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    if (search) return o.order_number.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Shop Management</h1>
        <p className="text-muted-foreground">Manage sellers, products, orders, and disputes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Sellers', value: stats.sellers, icon: Store, color: 'text-blue-500' },
          { label: 'Products', value: stats.products, icon: Package, color: 'text-purple-500' },
          { label: 'Orders', value: stats.orders, icon: ShoppingCart, color: 'text-green-500' },
          { label: 'Open Disputes', value: stats.disputes, icon: AlertTriangle, color: 'text-orange-500' },
          { label: 'Revenue', value: `$${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search sellers, products, orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sellers">Sellers</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
        </TabsList>

        {/* ── Sellers Tab ── */}
        <TabsContent value="sellers" className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sellers</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seller</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSellers.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No sellers found</TableCell></TableRow>
                  )}
                  {filteredSellers.map(s => (
                    <TableRow key={s.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={s.profile?.avatar_url || ''} />
                            <AvatarFallback>{s.profile?.initials || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground text-sm">{s.profile?.name}</p>
                            <p className="text-xs text-muted-foreground">@{s.profile?.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.business_name || '—'}</TableCell>
                      <TableCell><Badge className={statusColor(s.verification_status)}>{s.verification_status}</Badge></TableCell>
                      <TableCell className="text-sm">{s.total_sales}</TableCell>
                      <TableCell className="text-sm">${s.total_revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(s.joined_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        {s.verification_status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleVerifySeller(s, 'verified')}>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleVerifySeller(s, 'rejected')}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Products Tab ── */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Listed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No products found</TableCell></TableRow>
                  )}
                  {filteredProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground text-sm truncate max-w-[200px]">{p.title}</p>
                          <p className="text-xs text-muted-foreground">{p.category}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.seller?.name || '—'}</TableCell>
                      <TableCell className="text-sm font-medium">${p.price}</TableCell>
                      <TableCell className="text-sm">{p.stock}</TableCell>
                      <TableCell><Badge className={statusColor(p.status)}>{p.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'MMM d')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.status !== 'suspended' && (
                            <Button size="sm" variant="ghost" onClick={() => handleProductStatus(p, 'suspended')}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          {p.status === 'suspended' && (
                            <Button size="sm" variant="ghost" onClick={() => handleProductStatus(p, 'active')}>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Orders Tab ── */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={orderFilter} onValueChange={setOrderFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No orders found</TableCell></TableRow>
                  )}
                  {filteredOrders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                      <TableCell className="text-sm">{o.buyer?.name || '—'}</TableCell>
                      <TableCell className="text-sm font-medium">${o.total}</TableCell>
                      <TableCell><Badge className={statusColor(o.status)}>{o.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(o.created_at), 'MMM d, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Disputes Tab ── */}
        <TabsContent value="disputes" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No disputes found</TableCell></TableRow>
                  )}
                  {disputes.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.order?.order_number || '—'}</TableCell>
                      <TableCell className="text-sm">{d.reason}</TableCell>
                      <TableCell className="text-sm truncate max-w-[200px]">{d.description}</TableCell>
                      <TableCell><Badge className={statusColor(d.status)}>{d.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), 'MMM d')}</TableCell>
                      <TableCell>
                        {d.status === 'open' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleDisputeResolve(d, 'refunded')}>
                              Refund
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDisputeResolve(d, 'dismissed')}>
                              Dismiss
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
