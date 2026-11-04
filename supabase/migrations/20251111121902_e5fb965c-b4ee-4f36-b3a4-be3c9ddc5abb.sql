-- Drop existing problematic policies on orders table
DROP POLICY IF EXISTS "Users can view their own orders as buyer" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders as seller" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update their orders" ON public.orders;

-- Create security definer function to check if user is order buyer
CREATE OR REPLACE FUNCTION public.is_order_buyer(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = _order_id
      AND buyer_id = _user_id
  );
$$;

-- Create security definer function to check if user is order seller
CREATE OR REPLACE FUNCTION public.is_order_seller(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_id = _order_id
      AND seller_id = _user_id
  );
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Users can insert their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (buyer_id = auth.uid());

CREATE POLICY "Sellers can view orders containing their items"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_items.order_id = orders.id
      AND order_items.seller_id = auth.uid()
  )
);

CREATE POLICY "Sellers can update orders containing their items"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_items.order_id = orders.id
      AND order_items.seller_id = auth.uid()
  )
);