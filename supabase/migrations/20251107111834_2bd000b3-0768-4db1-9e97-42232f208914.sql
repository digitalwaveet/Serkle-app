-- Add missing update_item_stock function
CREATE OR REPLACE FUNCTION public.update_item_stock(item_id uuid, quantity_sold integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shop_items
  SET stock = stock - quantity_sold,
      updated_at = now()
  WHERE id = item_id;
END;
$$;