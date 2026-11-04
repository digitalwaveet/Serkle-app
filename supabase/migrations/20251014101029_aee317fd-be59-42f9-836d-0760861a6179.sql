-- Create videos table
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  thumbnail_url text,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for videos
CREATE POLICY "Videos are viewable by everyone"
  ON public.videos FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create videos"
  ON public.videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos"
  ON public.videos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos"
  ON public.videos FOR DELETE
  USING (auth.uid() = user_id);

-- Create video_stats table
CREATE TABLE public.video_stats (
  video_id uuid PRIMARY KEY REFERENCES public.videos(id) ON DELETE CASCADE,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  saves_count integer DEFAULT 0,
  views_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.video_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Video stats are viewable by everyone"
  ON public.video_stats FOR SELECT
  USING (true);

-- Function to create video stats automatically
CREATE OR REPLACE FUNCTION public.create_video_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.video_stats (video_id)
  VALUES (new.id);
  RETURN new;
END;
$$;

-- Trigger for auto-creating stats
CREATE TRIGGER on_video_created
  AFTER INSERT ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.create_video_stats();

-- Video Likes Table
CREATE TABLE public.video_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(video_id, user_id)
);

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Video likes are viewable by everyone"
  ON public.video_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like videos"
  ON public.video_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike videos"
  ON public.video_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Video Comments Table
CREATE TABLE public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.video_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Video comments are viewable by everyone"
  ON public.video_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create video comments"
  ON public.video_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own video comments"
  ON public.video_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own video comments"
  ON public.video_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Video Comment Likes
CREATE TABLE public.video_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.video_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.video_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Video comment likes are viewable by everyone"
  ON public.video_comment_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like video comments"
  ON public.video_comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike video comments"
  ON public.video_comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Video Saves
CREATE TABLE public.video_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(video_id, user_id)
);

ALTER TABLE public.video_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own video saves"
  ON public.video_saves FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save videos"
  ON public.video_saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave videos"
  ON public.video_saves FOR DELETE
  USING (auth.uid() = user_id);

-- Update video likes count trigger
CREATE OR REPLACE FUNCTION public.update_video_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.video_stats
    SET likes_count = likes_count + 1
    WHERE video_id = NEW.video_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.video_stats
    SET likes_count = likes_count - 1
    WHERE video_id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_video_like_change
  AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_likes_count();

-- Update video comments count trigger
CREATE OR REPLACE FUNCTION public.update_video_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.video_stats
    SET comments_count = comments_count + 1
    WHERE video_id = NEW.video_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.video_stats
    SET comments_count = comments_count - 1
    WHERE video_id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_video_comment_change
  AFTER INSERT OR DELETE ON public.video_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_comments_count();

-- Update video saves count trigger
CREATE OR REPLACE FUNCTION public.update_video_saves_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.video_stats
    SET saves_count = saves_count + 1
    WHERE video_id = NEW.video_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.video_stats
    SET saves_count = saves_count - 1
    WHERE video_id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_video_save_change
  AFTER INSERT OR DELETE ON public.video_saves
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_saves_count();

-- Update profile video count trigger
CREATE OR REPLACE FUNCTION public.update_profile_video_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.profile_stats
    SET videos_count = videos_count + 1
    WHERE user_id = NEW.user_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.profile_stats
    SET videos_count = videos_count - 1
    WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_video_count_change
  AFTER INSERT OR DELETE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_video_count();

-- Function to get video feed
CREATE OR REPLACE FUNCTION public.get_video_feed(
  page_num integer DEFAULT 0,
  page_size integer DEFAULT 10
)
RETURNS TABLE(
  video_id uuid,
  user_id uuid,
  username text,
  name text,
  initials text,
  avatar_url text,
  avatar_color text,
  is_verified boolean,
  video_url text,
  thumbnail_url text,
  title text,
  description text,
  tags text[],
  created_at timestamp with time zone,
  likes_count integer,
  comments_count integer,
  shares_count integer,
  saves_count integer,
  views_count integer,
  user_has_liked boolean,
  user_has_saved boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    v.id as video_id,
    prof.id as user_id,
    prof.username,
    prof.name,
    prof.initials,
    prof.avatar_url,
    prof.avatar_color,
    prof.is_verified,
    v.video_url,
    v.thumbnail_url,
    v.title,
    v.description,
    v.tags,
    v.created_at,
    vs.likes_count,
    vs.comments_count,
    vs.shares_count,
    vs.saves_count,
    vs.views_count,
    EXISTS(
      SELECT 1 FROM public.video_likes vl
      WHERE vl.video_id = v.id AND vl.user_id = auth.uid()
    ) as user_has_liked,
    EXISTS(
      SELECT 1 FROM public.video_saves vsv
      WHERE vsv.video_id = v.id AND vsv.user_id = auth.uid()
    ) as user_has_saved
  FROM public.videos v
  INNER JOIN public.profiles prof ON v.user_id = prof.id
  INNER JOIN public.video_stats vs ON v.id = vs.video_id
  ORDER BY v.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$$;

-- Function to get video comments
CREATE OR REPLACE FUNCTION public.get_video_comments(_video_id uuid)
RETURNS TABLE(
  comment_id uuid,
  content text,
  created_at timestamp with time zone,
  parent_id uuid,
  user_id uuid,
  username text,
  name text,
  initials text,
  avatar_url text,
  avatar_color text,
  likes_count bigint,
  user_has_liked boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    vc.id as comment_id,
    vc.content,
    vc.created_at,
    vc.parent_id,
    prof.id as user_id,
    prof.username,
    prof.name,
    prof.initials,
    prof.avatar_url,
    prof.avatar_color,
    COUNT(vcl.id) as likes_count,
    EXISTS(
      SELECT 1 FROM public.video_comment_likes vcl2
      WHERE vcl2.comment_id = vc.id AND vcl2.user_id = auth.uid()
    ) as user_has_liked
  FROM public.video_comments vc
  INNER JOIN public.profiles prof ON vc.user_id = prof.id
  LEFT JOIN public.video_comment_likes vcl ON vc.id = vcl.comment_id
  WHERE vc.video_id = _video_id
  GROUP BY vc.id, prof.id
  ORDER BY vc.created_at ASC;
$$;

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('video-media', 'video-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for video storage bucket
CREATE POLICY "Video media is viewable by everyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'video-media');

CREATE POLICY "Authenticated users can upload videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'video-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'video-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'video-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );