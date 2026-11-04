-- ============================================================================
-- CIRCLE VIDEO INTERACTIONS - LIKES & COMMENTS
-- ============================================================================

-- 1. Create circle_video_likes table
CREATE TABLE IF NOT EXISTS public.circle_video_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.circle_videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (video_id, user_id)
);

-- 2. Create circle_video_comments table
CREATE TABLE IF NOT EXISTS public.circle_video_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.circle_videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.circle_video_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Add shares_count to circle_videos if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='circle_videos' AND column_name='shares_count') THEN
    ALTER TABLE public.circle_videos ADD COLUMN shares_count integer DEFAULT 0;
  END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE public.circle_video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_video_comments ENABLE ROW LEVEL SECURITY;

-- 5. Setup Policies

-- circle_video_likes policies
DROP POLICY IF EXISTS "circle_video_likes_select_policy" ON public.circle_video_likes;
CREATE POLICY "circle_video_likes_select_policy" ON public.circle_video_likes FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "circle_video_likes_insert_policy" ON public.circle_video_likes;
CREATE POLICY "circle_video_likes_insert_policy" ON public.circle_video_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "circle_video_likes_delete_policy" ON public.circle_video_likes;
CREATE POLICY "circle_video_likes_delete_policy" ON public.circle_video_likes FOR DELETE 
USING (auth.uid() = user_id);

-- circle_video_comments policies
DROP POLICY IF EXISTS "circle_video_comments_select_policy" ON public.circle_video_comments;
CREATE POLICY "circle_video_comments_select_policy" ON public.circle_video_comments FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "circle_video_comments_insert_policy" ON public.circle_video_comments;
CREATE POLICY "circle_video_comments_insert_policy" ON public.circle_video_comments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "circle_video_comments_update_policy" ON public.circle_video_comments;
CREATE POLICY "circle_video_comments_update_policy" ON public.circle_video_comments FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "circle_video_comments_delete_policy" ON public.circle_video_comments;
CREATE POLICY "circle_video_comments_delete_policy" ON public.circle_video_comments FOR DELETE 
USING (auth.uid() = user_id);

-- 6. Functions for atomic increments
CREATE OR REPLACE FUNCTION public.increment_video_shares(video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.circle_videos
  SET shares_count = COALESCE(shares_count, 0) + 1
  WHERE id = video_id;
END;
$$;
