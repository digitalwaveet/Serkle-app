-- Add premium post features to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS has_tips_enabled BOOLEAN DEFAULT TRUE;

-- Create circle_subscriptions table for premium content access
CREATE TABLE IF NOT EXISTS public.circle_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(circle_id, user_id)
);

-- Enable RLS on circle_subscriptions
ALTER TABLE public.circle_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for circle_subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.circle_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can subscribe to circles" ON public.circle_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.circle_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to check if user has subscription
CREATE OR REPLACE FUNCTION public.has_circle_subscription(_circle_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_subscriptions
    WHERE circle_id = _circle_id
      AND user_id = _user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Update posts RLS policy to enforce premium content access
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;

CREATE POLICY "Free posts viewable by everyone" ON public.posts
  FOR SELECT USING (
    NOT is_premium 
    OR circle_id IS NULL
    OR auth.uid() = user_id
    OR (circle_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.circles WHERE id = posts.circle_id AND creator_id = auth.uid())
      OR has_circle_subscription(circle_id, auth.uid())
    ))
  );