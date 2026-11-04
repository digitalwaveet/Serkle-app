import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SellerOrderItem {
  id: string;
  title: string;
  image: string;
  quantity: number;
  price_at_purchase: number;
  status: string;
}

export interface SellerOrder {
  id: string;
  order_number: string;
  buyer_id: string;
  buyer_name: string;
  buyer_avatar: string;
  status: string;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  created_at: string;
  updated_at: string;
  estimated_delivery: string;
  items: SellerOrderItem[];
}

export const useSellerOrders = () => {
  return useQuery({
    queryKey: ['seller-orders'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get order items where the seller is the current user
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          item_id,
          quantity,
          price_at_purchase,
          status,
          shop_items!inner(
            id,
            title,
            images
          )
        `)
        .eq('seller_id', user.id);

      if (itemsError) throw itemsError;

      // Get unique order IDs
      const orderIds = [...new Set(orderItems?.map(item => item.order_id) || [])];

      if (orderIds.length === 0) return [];

      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          profiles!orders_buyer_id_fkey(
            name,
            avatar_url
          )
        `)
        .in('id', orderIds)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Map orders with their items
      const sellerOrders: SellerOrder[] = (orders || []).map(order => {
        const items = (orderItems || [])
          .filter(item => item.order_id === order.id)
          .map(item => ({
            id: item.id,
            title: (item.shop_items as any)?.title || 'Unknown Item',
            image: (item.shop_items as any)?.images?.[0] || '',
            quantity: item.quantity,
            price_at_purchase: item.price_at_purchase,
            status: item.status,
          }));

        return {
          id: order.id,
          order_number: order.order_number,
          buyer_id: order.buyer_id,
          buyer_name: (order.profiles as any)?.name || 'Unknown Buyer',
          buyer_avatar: (order.profiles as any)?.avatar_url || '',
          status: order.status,
          subtotal: order.subtotal,
          shipping_cost: order.shipping_cost,
          tax: order.tax,
          total: order.total,
          created_at: order.created_at,
          updated_at: order.updated_at,
          estimated_delivery: order.estimated_delivery,
          items,
        };
      });

      return sellerOrders;
    },
  });
};
