-- Add FCM token storage for push notifications
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token ON public.profiles(fcm_token) WHERE fcm_token IS NOT NULL;

-- Create notifications table for tracking sent notifications
CREATE TABLE IF NOT EXISTS public.push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on push_notifications
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.push_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.push_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id ON public.push_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_sent_at ON public.push_notifications(sent_at DESC);