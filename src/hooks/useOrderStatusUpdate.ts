import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UpdateOrderStatusData {
  orderId: string;
  status: string;
}

export const useOrderStatusUpdate = () => {
  const queryClient = useQueryClient();

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: UpdateOrderStatusData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Update all order items status
      const { error: itemsError } = await supabase
        .from('order_items')
        .update({ status })
        .eq('order_id', orderId)
        .eq('seller_id', user.id);

      if (itemsError) throw itemsError;

      return { orderId, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast({
        title: "Order updated",
        description: "Order status has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return { updateOrderStatus };
};
