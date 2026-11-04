-- Add missing columns to helper_profiles for streak tracking
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'helper_profiles' 
                 AND column_name = 'last_response_date') THEN
    ALTER TABLE public.helper_profiles ADD COLUMN last_response_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'helper_profiles' 
                 AND column_name = 'current_streak_days') THEN
    ALTER TABLE public.helper_profiles ADD COLUMN current_streak_days INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'helper_profiles' 
                 AND column_name = 'total_stars') THEN
    ALTER TABLE public.helper_profiles ADD COLUMN total_stars INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create function to update helper stats when responding
CREATE OR REPLACE FUNCTION update_helper_response_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_date DATE;
  curr_date DATE;
BEGIN
  curr_date := CURRENT_DATE;
  
  -- Get helper's last response date
  SELECT last_response_date INTO last_date
  FROM helper_profiles
  WHERE user_id = NEW.helper_user_id;
  
  -- Update response count
  UPDATE helper_profiles
  SET response_count = response_count + 1
  WHERE user_id = NEW.helper_user_id;
  
  -- Update streak
  IF last_date IS NULL THEN
    -- First response ever
    UPDATE helper_profiles
    SET 
      current_streak_days = 1,
      last_response_date = curr_date
    WHERE user_id = NEW.helper_user_id;
  ELSIF last_date = curr_date THEN
    -- Already responded today, no change to streak
    RETURN NEW;
  ELSIF last_date = curr_date - 1 THEN
    -- Consecutive day, increment streak
    UPDATE helper_profiles
    SET 
      current_streak_days = current_streak_days + 1,
      last_response_date = curr_date
    WHERE user_id = NEW.helper_user_id;
  ELSE
    -- Streak broken, reset to 1
    UPDATE helper_profiles
    SET 
      current_streak_days = 1,
      last_response_date = curr_date
    WHERE user_id = NEW.helper_user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger for helper response
DROP TRIGGER IF EXISTS update_helper_stats_on_response ON public.sos_helpers;
CREATE TRIGGER update_helper_stats_on_response
  AFTER INSERT ON public.sos_helpers
  FOR EACH ROW
  EXECUTE FUNCTION update_helper_response_stats();

-- Create function to update completion count when alert is resolved
CREATE OR REPLACE FUNCTION update_helper_completion_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update when status changes to resolved
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    -- Update completion count for all helpers who marked themselves as completed
    UPDATE helper_profiles hp
    SET completion_count = completion_count + 1
    FROM sos_helpers sh
    WHERE hp.user_id = sh.helper_user_id
      AND sh.alert_id = NEW.id
      AND sh.status = 'completed';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger for alert resolution
DROP TRIGGER IF EXISTS update_helper_stats_on_resolution ON public.sos_alerts;
CREATE TRIGGER update_helper_stats_on_resolution
  AFTER UPDATE ON public.sos_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_helper_completion_stats();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_helper_profiles_last_response 
ON helper_profiles(last_response_date);