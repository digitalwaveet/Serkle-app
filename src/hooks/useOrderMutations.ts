import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CartItem, ShippingAddress, PaymentMethod } from "@/types/cart";

interface CreateOrderData {
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

export const useOrderMutations = () => {
  const queryClient = useQueryClient();

  const createOrder = useMutation({
    mutationFn: async (data: CreateOrderData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate order number
      const { data: orderNumber } = await supabase.rpc('generate_order_number');
      
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          order_number: orderNumber,
          status: 'pending',
          subtotal: data.subtotal,
          shipping_cost: data.shipping,
          tax: data.tax,
          total: data.total,
          estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = data.items.map(item => ({
        order_id: order.id,
        item_id: item.shopItemId,
        seller_id: item.seller.id,
        quantity: item.quantity,
        price_at_purchase: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Update stock for each item and seller stats
      for (const item of data.items) {
        const { error: stockError } = await supabase.rpc('update_item_stock', {
          item_id: item.shopItemId,
          quantity_sold: item.quantity
        });

        if (stockError) {
          console.error('Failed to update stock:', stockError);
        }

        // Update seller total_sales
        const { data: sellerProfile } = await supabase
          .from('seller_profiles')
          .select('total_sales')
          .eq('user_id', item.seller.id)
          .maybeSingle();

        if (sellerProfile) {
          await supabase
            .from('seller_profiles')
            .update({ total_sales: (sellerProfile.total_sales || 0) + item.quantity })
            .eq('user_id', item.seller.id);
        }
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
      toast.success('Order placed successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create order: ${error.message}`);
    }
  });

  return {
    createOrder
  };
};
