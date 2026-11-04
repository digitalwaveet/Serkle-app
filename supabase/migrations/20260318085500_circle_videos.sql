-- ============================================================================
-- CIRCLE VIDEOS ENHANCEMENT - SCHEMA UPDATE
-- ============================================================================

-- Function to check if a user is an admin or creator of a circle
CREATE OR REPLACE FUNCTION public.is_circle_admin(_circle_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members
    WHERE circle_id = _circle_id
      AND user_id = _user_id
      AND role IN ('creator', 'admin')
      AND status = 'active'
  );
$$;

-- 1. Create video_playlists table
CREATE TABLE IF NOT EXISTS public.video_playlists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  thumbnail_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Create circle_videos table
CREATE TABLE IF NOT EXISTS public.circle_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  playlist_id uuid REFERENCES public.video_playlists(id) ON DELETE SET NULL,
  video_url text NOT NULL,
  thumbnail_url text,
  title text NOT NULL,
  description text,
  is_premium boolean DEFAULT false,
  price integer DEFAULT 0,
  duration text,
  views_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. Create video_unlocks table
CREATE TABLE IF NOT EXISTS public.video_unlocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.circle_videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_paid integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (video_id, user_id)
);

-- 4. Update circle_tips table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='circle_tips' AND column_name='video_id') THEN
    ALTER TABLE public.circle_tips ADD COLUMN video_id uuid REFERENCES public.circle_videos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Enable RLS
ALTER TABLE public.video_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_unlocks ENABLE ROW LEVEL SECURITY;

-- 6. Setup Policies

-- video_playlists policies
CREATE POLICY "video_playlists_select_policy" ON public.video_playlists FOR SELECT 
USING (
  EXISTS(SELECT 1 FROM public.circles WHERE circles.id = video_playlists.circle_id AND NOT circles.is_private) 
  OR public.is_circle_member(circle_id, auth.uid()) 
  OR user_id = auth.uid()
);

CREATE POLICY "video_playlists_insert_policy" ON public.video_playlists FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND (EXISTS(SELECT 1 FROM public.circles WHERE circles.id = circle_id AND (circles.creator_id = auth.uid() OR public.is_circle_admin(circle_id, auth.uid()))))
);

CREATE POLICY "video_playlists_update_policy" ON public.video_playlists FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "video_playlists_delete_policy" ON public.video_playlists FOR DELETE 
USING (auth.uid() = user_id);

-- circle_videos policies
CREATE POLICY "circle_videos_select_policy" ON public.circle_videos FOR SELECT 
USING (
  auth.uid() = user_id 
  OR EXISTS(SELECT 1 FROM public.circles WHERE circles.id = circle_videos.circle_id AND (circles.creator_id = auth.uid() OR public.is_circle_admin(circle_id, auth.uid()))) 
  OR public.is_circle_member(circle_id, auth.uid()) 
  OR (EXISTS(SELECT 1 FROM public.circles WHERE circles.id = circle_videos.circle_id AND NOT circles.is_private))
);

CREATE POLICY "circle_videos_insert_policy" ON public.circle_videos FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND (EXISTS(SELECT 1 FROM public.circles WHERE circles.id = circle_id AND (circles.creator_id = auth.uid() OR public.is_circle_admin(circle_id, auth.uid()))))
);

CREATE POLICY "circle_videos_update_policy" ON public.circle_videos FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "circle_videos_delete_policy" ON public.circle_videos FOR DELETE 
USING (auth.uid() = user_id);

-- video_unlocks policies
CREATE POLICY "video_unlocks_select_policy" ON public.video_unlocks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "video_unlocks_insert_policy" ON public.video_unlocks FOR INSERT 
WITH CHECK (auth.uid() = user_id);
