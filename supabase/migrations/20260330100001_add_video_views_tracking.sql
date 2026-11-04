-- Create video_views table for precise tracking
CREATE TABLE IF NOT EXISTS public.video_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Index for quick lookups on recent views
CREATE INDEX IF NOT EXISTS idx_video_views_lookup 
  ON public.video_views(video_id, user_id, session_id, created_at);

-- Add RLS
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

-- Allow inserts from authenticated and anonymous users
CREATE POLICY "Anyone can insert video view" 
  ON public.video_views FOR INSERT 
  WITH CHECK (true);

-- Allow selects (mostly for admin or internal use, but we can make it viewable by video owner or just everyone)
CREATE POLICY "Video views are viewable by everyone" 
  ON public.video_views FOR SELECT 
  USING (true);

-- RPC for securely tracking a view
CREATE OR REPLACE FUNCTION public.track_video_view(
  p_video_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recent_view_exists boolean;
BEGIN
  -- Prevent completely anonymous views without session
  IF p_user_id IS NULL AND (p_session_id IS NULL OR p_session_id = '') THEN
    RETURN;
  END IF;

  -- Check if there's a recent view from this user or session in the last 30 minutes
  SELECT EXISTS (
    SELECT 1 FROM public.video_views
    WHERE video_id = p_video_id
      AND created_at > (now() - interval '30 minutes')
      AND (
        (p_user_id IS NOT NULL AND user_id = p_user_id) OR
        (p_session_id IS NOT NULL AND session_id = p_session_id)
      )
  ) INTO v_recent_view_exists;
  
  IF NOT v_recent_view_exists THEN
    -- Insert the new view
    INSERT INTO public.video_views (video_id, user_id, session_id)
    VALUES (p_video_id, p_user_id, p_session_id);
    
    -- Increment the views_count in video_stats
    UPDATE public.video_stats
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE video_id = p_video_id;
  END IF;
END;
$$;
