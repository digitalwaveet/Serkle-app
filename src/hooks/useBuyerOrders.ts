import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BuyerOrderItem {
  id: string;
  title: string;
  image: string;
  quantity: number;
  price_at_purchase: number;
  seller_name: string;
  seller_id: string;
}

export interface BuyerOrder {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  created_at: string;
  updated_at: string;
  estimated_delivery: string;
  items: BuyerOrderItem[];
}

export const useBuyerOrders = () => {
  return useQuery({
    queryKey: ['buyer-orders'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            item_id,
            quantity,
            price_at_purchase,
            seller_id,
            shop_items!inner(
              id,
              title,
              images
            ),
            profiles!order_items_seller_id_fkey(
              name
            )
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const buyerOrders: BuyerOrder[] = (orders || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        tax: order.tax,
        total: order.total,
        created_at: order.created_at,
        updated_at: order.updated_at,
        estimated_delivery: order.estimated_delivery,
        items: (order.order_items || []).map((item: any) => ({
          id: item.id,
          title: item.shop_items?.title || 'Unknown Item',
          image: item.shop_items?.images?.[0] || '',
          quantity: item.quantity,
          price_at_purchase: item.price_at_purchase,
          seller_name: item.profiles?.name || 'Unknown Seller',
          seller_id: item.seller_id,
        })),
      }));

      return buyerOrders;
    },
  });
};
