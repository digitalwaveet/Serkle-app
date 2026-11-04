import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FlashSale {
  id: string;
  item_id: string;
  original_price: number;
  sale_price: number;
  start_time: string;
  end_time: string;
  quantity_limit: number;
  quantity_sold: number;
  status: string;
  item: {
    id: string;
    title: string;
    images: string[];
    category: string;
    seller_id: string;
  };
}

export const useFlashSales = () => {
  return useQuery({
    queryKey: ['flash-sales'],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('flash_sales')
        .select(`
          *,
          shop_items!inner(
            id,
            title,
            images,
            category,
            seller_id
          )
        `)
        .eq('status', 'active')
        .lte('start_time', now)
        .gte('end_time', now);

      if (error) throw error;

      return (data || []).map(sale => ({
        id: sale.id,
        item_id: sale.item_id,
        original_price: Number(sale.original_price),
        sale_price: Number(sale.sale_price),
        start_time: sale.start_time,
        end_time: sale.end_time,
        quantity_limit: sale.quantity_limit,
        quantity_sold: sale.quantity_sold,
        status: sale.status,
        item: {
          id: (sale.shop_items as any).id,
          title: (sale.shop_items as any).title,
          images: (sale.shop_items as any).images,
          category: (sale.shop_items as any).category,
          seller_id: (sale.shop_items as any).seller_id,
        }
      })) as FlashSale[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
