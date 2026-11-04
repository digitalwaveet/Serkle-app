-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  sos_alerts BOOLEAN DEFAULT true,
  helper_responses BOOLEAN DEFAULT true,
  alert_updates BOOLEAN DEFAULT true,
  emergency_contact_alerts BOOLEAN DEFAULT true,
  max_distance_km INTEGER DEFAULT 10,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create abuse reports table
CREATE TABLE IF NOT EXISTS public.abuse_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES public.sos_alerts(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('false_alert', 'harassment', 'inappropriate_content', 'spam', 'other')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT
);

-- Enable RLS
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create abuse reports"
ON public.abuse_reports
FOR INSERT
WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Users can view own reports"
ON public.abuse_reports
FOR SELECT
USING (auth.uid() = reporter_user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for geospatial queries on notification preferences
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user 
ON public.notification_preferences(user_id) WHERE enabled = true;

-- Add index for abuse reports
CREATE INDEX IF NOT EXISTS idx_abuse_reports_status 
ON public.abuse_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_abuse_reports_alert 
ON public.abuse_reports(alert_id) WHERE alert_id IS NOT NULL;