-- Add buyer_id to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES auth.users(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
