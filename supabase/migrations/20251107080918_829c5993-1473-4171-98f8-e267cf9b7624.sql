-- Add RLS policy to ensure only alert creators can update alert status
DROP POLICY IF EXISTS "Users can update own SOS alerts" ON public.sos_alerts;

CREATE POLICY "Users can update own SOS alerts"
ON public.sos_alerts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_sos_alerts_user_created 
ON public.sos_alerts(user_id, created_at DESC);

-- Add index for pagination
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status_created 
ON public.sos_alerts(status, created_at DESC) 
WHERE status IN ('active', 'responding');