-- Fix function search path for generate_order_number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_num TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    order_num := 'ORD-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    SELECT COUNT(*) INTO exists_check FROM public.orders WHERE order_number = order_num;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN order_num;
END;
$$;