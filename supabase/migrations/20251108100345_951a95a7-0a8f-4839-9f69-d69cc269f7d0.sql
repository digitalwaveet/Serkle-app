-- Create helper_requests table for individual helper targeting
CREATE TABLE IF NOT EXISTS public.helper_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.sos_alerts(id) ON DELETE CASCADE,
  helper_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  estimated_arrival_minutes INTEGER,
  request_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT helper_requests_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired'))
);

-- Enable RLS
ALTER TABLE public.helper_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Helpers can view requests sent to them"
  ON public.helper_requests
  FOR SELECT
  USING (auth.uid() = helper_id);

CREATE POLICY "Alert owners can view their helper requests"
  ON public.helper_requests
  FOR SELECT
  USING (auth.uid() = requester_id);

CREATE POLICY "Alert owners can create helper requests"
  ON public.helper_requests
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Helpers can update their request status"
  ON public.helper_requests
  FOR UPDATE
  USING (auth.uid() = helper_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_helper_requests_helper_id ON public.helper_requests(helper_id);
CREATE INDEX IF NOT EXISTS idx_helper_requests_alert_id ON public.helper_requests(alert_id);
CREATE INDEX IF NOT EXISTS idx_helper_requests_status ON public.helper_requests(status);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.helper_requests;