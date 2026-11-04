
-- Add subscription columns to circles table
ALTER TABLE public.circles 
  ADD COLUMN IF NOT EXISTS subscription_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_price integer NOT NULL DEFAULT 10;

-- Create circle notification preferences table
CREATE TABLE IF NOT EXISTS public.circle_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(circle_id, user_id)
);

-- Enable RLS
ALTER TABLE public.circle_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own notification preferences"
  ON public.circle_notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
