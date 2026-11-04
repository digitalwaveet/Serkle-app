-- Create update timestamp function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create service bookings table
CREATE TABLE public.circle_service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.circle_services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  member_name TEXT NOT NULL,
  member_email TEXT NOT NULL,
  member_phone TEXT,
  notes TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.circle_service_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bookings
CREATE POLICY "Users can view own bookings"
ON public.circle_service_bookings
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Service providers can view all bookings for their services
CREATE POLICY "Providers can view service bookings"
ON public.circle_service_bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.circle_services cs
    WHERE cs.id = circle_service_bookings.service_id
    AND cs.provider_id = auth.uid()
  )
);

-- Policy: Circle members can book services
CREATE POLICY "Members can book services"
ON public.circle_service_bookings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.circle_services cs
    JOIN public.circle_members cm ON cs.circle_id = cm.circle_id
    WHERE cs.id = service_id
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

-- Policy: Users can update their own bookings (for cancellation)
CREATE POLICY "Users can update own bookings"
ON public.circle_service_bookings
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Providers can update bookings for their services
CREATE POLICY "Providers can update service bookings"
ON public.circle_service_bookings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.circle_services cs
    WHERE cs.id = circle_service_bookings.service_id
    AND cs.provider_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_service_bookings_service_id ON public.circle_service_bookings(service_id);
CREATE INDEX idx_service_bookings_user_id ON public.circle_service_bookings(user_id);
CREATE INDEX idx_service_bookings_status ON public.circle_service_bookings(status);

-- Update trigger for updated_at
CREATE TRIGGER update_service_bookings_updated_at
BEFORE UPDATE ON public.circle_service_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();