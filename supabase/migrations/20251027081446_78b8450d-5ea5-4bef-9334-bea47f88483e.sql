-- Create SOS Alerts Table
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sos_type TEXT NOT NULL CHECK (sos_type IN ('medical', 'lost', 'safety', 'emergency')),
  sub_category TEXT,
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'responding', 'resolved', 'cancelled')),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_address TEXT,
  share_live_location BOOLEAN DEFAULT false,
  person_age TEXT,
  person_description TEXT,
  last_seen TEXT,
  injury_type TEXT,
  conscious_level TEXT,
  threat_active BOOLEAN,
  photo_urls TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Create SOS Helpers Table
CREATE TABLE IF NOT EXISTS public.sos_helpers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.sos_alerts(id) ON DELETE CASCADE,
  helper_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'responding' CHECK (status IN ('responding', 'arrived', 'completed', 'cancelled')),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_arrival_minutes INTEGER,
  current_lat DECIMAL(10, 8),
  current_lng DECIMAL(11, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(alert_id, helper_user_id)
);

-- Create SOS Messages Table
CREATE TABLE IF NOT EXISTS public.sos_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.sos_alerts(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  is_system_message BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create Helper Profiles Table
CREATE TABLE IF NOT EXISTS public.helper_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT false,
  availability_status TEXT DEFAULT 'offline' CHECK (availability_status IN ('available', 'busy', 'offline')),
  skills TEXT[],
  response_count INTEGER DEFAULT 0,
  completion_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  average_response_time_minutes INTEGER DEFAULT 0,
  total_stars INTEGER DEFAULT 0,
  helper_badge TEXT DEFAULT 'Bronze Helper',
  current_streak_days INTEGER DEFAULT 0,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create SOS Reviews Table
CREATE TABLE IF NOT EXISTS public.sos_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.sos_alerts(id) ON DELETE CASCADE,
  helper_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(alert_id, helper_user_id, reviewer_user_id)
);

-- Create Emergency Contacts Table
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  relationship TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_helpers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helper_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sos_alerts
CREATE POLICY "Anyone can view active SOS alerts"
  ON public.sos_alerts
  FOR SELECT
  USING (status IN ('active', 'responding'));

CREATE POLICY "Authenticated users can create SOS alerts"
  ON public.sos_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own SOS alerts"
  ON public.sos_alerts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own SOS alerts"
  ON public.sos_alerts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for sos_helpers
CREATE POLICY "Helpers can view responses for alerts they're involved in"
  ON public.sos_helpers
  FOR SELECT
  USING (
    auth.uid() = helper_user_id 
    OR auth.uid() IN (SELECT user_id FROM public.sos_alerts WHERE id = alert_id)
  );

CREATE POLICY "Authenticated users can offer help"
  ON public.sos_helpers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = helper_user_id);

CREATE POLICY "Helpers can update own responses"
  ON public.sos_helpers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = helper_user_id)
  WITH CHECK (auth.uid() = helper_user_id);

CREATE POLICY "Helpers can cancel own responses"
  ON public.sos_helpers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = helper_user_id);

-- RLS Policies for sos_messages
CREATE POLICY "Participants can view messages"
  ON public.sos_messages
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.sos_alerts WHERE id = alert_id
      UNION
      SELECT helper_user_id FROM public.sos_helpers WHERE alert_id = sos_messages.alert_id
    )
  );

CREATE POLICY "Participants can send messages"
  ON public.sos_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND auth.uid() IN (
      SELECT user_id FROM public.sos_alerts WHERE id = alert_id
      UNION
      SELECT helper_user_id FROM public.sos_helpers WHERE alert_id = sos_messages.alert_id
    )
  );

-- RLS Policies for helper_profiles
CREATE POLICY "Anyone can view helper profiles"
  ON public.helper_profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create own helper profile"
  ON public.helper_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own helper profile"
  ON public.helper_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for sos_reviews
CREATE POLICY "Anyone can view reviews"
  ON public.sos_reviews
  FOR SELECT
  USING (true);

CREATE POLICY "Alert creators can review helpers"
  ON public.sos_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_user_id
    AND auth.uid() IN (SELECT user_id FROM public.sos_alerts WHERE id = alert_id)
  );

-- RLS Policies for emergency_contacts
CREATE POLICY "Users can view own emergency contacts"
  ON public.emergency_contacts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own emergency contacts"
  ON public.emergency_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emergency contacts"
  ON public.emergency_contacts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own emergency contacts"
  ON public.emergency_contacts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create distance calculation function using Haversine formula
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 DECIMAL, 
  lon1 DECIMAL, 
  lat2 DECIMAL, 
  lon2 DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  -- Haversine formula for distance in miles
  RETURN (
    3959 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(lat1)) * cos(radians(lat2)) * 
        cos(radians(lon2) - radians(lon1)) + 
        sin(radians(lat1)) * sin(radians(lat2))
      ))
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to get nearby alerts
CREATE OR REPLACE FUNCTION public.get_nearby_alerts(
  user_lat DECIMAL,
  user_lng DECIMAL,
  radius_miles DECIMAL DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  sos_type TEXT,
  sub_category TEXT,
  urgency TEXT,
  description TEXT,
  status TEXT,
  location_lat DECIMAL,
  location_lng DECIMAL,
  location_address TEXT,
  share_live_location BOOLEAN,
  person_age TEXT,
  person_description TEXT,
  last_seen TEXT,
  injury_type TEXT,
  conscious_level TEXT,
  threat_active BOOLEAN,
  photo_urls TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  distance_miles DECIMAL,
  helper_count BIGINT
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.sos_type,
    a.sub_category,
    a.urgency,
    a.description,
    a.status,
    a.location_lat,
    a.location_lng,
    a.location_address,
    a.share_live_location,
    a.person_age,
    a.person_description,
    a.last_seen,
    a.injury_type,
    a.conscious_level,
    a.threat_active,
    a.photo_urls,
    a.created_at,
    a.updated_at,
    a.resolved_at,
    calculate_distance(user_lat, user_lng, a.location_lat, a.location_lng) as distance_miles,
    COUNT(h.id) as helper_count
  FROM public.sos_alerts a
  LEFT JOIN public.sos_helpers h ON a.id = h.alert_id AND h.status IN ('responding', 'arrived')
  WHERE a.status IN ('active', 'responding')
    AND a.location_lat IS NOT NULL
    AND a.location_lng IS NOT NULL
    AND calculate_distance(user_lat, user_lng, a.location_lat, a.location_lng) <= radius_miles
  GROUP BY a.id
  ORDER BY distance_miles ASC;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_sos_alerts_updated_at
  BEFORE UPDATE ON public.sos_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_helper_profiles_updated_at
  BEFORE UPDATE ON public.helper_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_sos_alerts_status ON public.sos_alerts(status);
CREATE INDEX idx_sos_alerts_location ON public.sos_alerts(location_lat, location_lng);
CREATE INDEX idx_sos_alerts_created_at ON public.sos_alerts(created_at DESC);
CREATE INDEX idx_sos_helpers_alert_id ON public.sos_helpers(alert_id);
CREATE INDEX idx_sos_helpers_helper_user_id ON public.sos_helpers(helper_user_id);
CREATE INDEX idx_sos_messages_alert_id ON public.sos_messages(alert_id);
CREATE INDEX idx_helper_profiles_availability ON public.helper_profiles(is_available, availability_status);
CREATE INDEX idx_helper_profiles_location ON public.helper_profiles(location_lat, location_lng);

-- Enable Realtime for SOS tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_helpers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.helper_profiles;