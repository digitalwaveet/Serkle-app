-- Create disputes table
CREATE TABLE public.disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create refunds table
CREATE TABLE public.refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  dispute_id UUID REFERENCES disputes(id),
  amount DECIMAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Disputes policies
CREATE POLICY "Buyers can create disputes for own orders"
ON public.disputes FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can view disputes they are part of"
ON public.disputes FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers and sellers can update disputes"
ON public.disputes FOR UPDATE
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Refunds policies
CREATE POLICY "Users can view refunds for their disputes"
ON public.refunds FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM disputes 
    WHERE disputes.id = refunds.dispute_id 
    AND (disputes.buyer_id = auth.uid() OR disputes.seller_id = auth.uid())
  )
);

-- Add indexes
CREATE INDEX idx_disputes_buyer ON disputes(buyer_id);
CREATE INDEX idx_disputes_seller ON disputes(seller_id);
CREATE INDEX idx_disputes_order ON disputes(order_id);
CREATE INDEX idx_refunds_order ON refunds(order_id);