-- Fix RLS policy for sos_alerts to allow users to view their own alerts regardless of status
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view active SOS alerts" ON public.sos_alerts;

-- Create updated policies that allow viewing own alerts + active alerts
CREATE POLICY "Users can view own SOS alerts"
ON public.sos_alerts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active SOS alerts from others"
ON public.sos_alerts
FOR SELECT
USING (
  status IN ('active', 'responding') 
  AND auth.uid() != user_id
);