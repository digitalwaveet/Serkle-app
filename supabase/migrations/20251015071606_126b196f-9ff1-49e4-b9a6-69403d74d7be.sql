-- Fix last remaining SQL functions with search_path issues

-- Update get_video_feed function
CREATE OR REPLACE FUNCTION public.get_video_feed(page_num integer DEFAULT 0, page_size integer DEFAULT 10)
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
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Update get_feed_posts function
CREATE OR REPLACE FUNCTION public.get_feed_posts(page_num integer DEFAULT 0, page_size integer DEFAULT 10)
RETURNS TABLE(
  post_id uuid,
  content text,
  media_url text,
  media_urls text[],
  media_alt text,
  media_color_from text,
  media_color_to text,
  tags text[],
  is_sponsored boolean,
  created_at timestamp with time zone,
  user_id uuid,
  username text,
  name text,
  initials text,
  avatar_url text,
  avatar_color text,
  is_verified boolean,
  likes_count integer,
  comments_count integer,
  shares_count integer,
  saves_count integer,
  user_has_liked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    p.id as post_id,
    p.content,
    p.media_url,
    p.media_urls,
    p.media_alt,
    p.media_color_from,
    p.media_color_to,
    p.tags,
    p.is_sponsored,
    p.created_at,
    prof.id as user_id,
    prof.username,
    prof.name,
    prof.initials,
    prof.avatar_url,
    prof.avatar_color,
    prof.is_verified,
    ps.likes_count,
    ps.comments_count,
    ps.shares_count,
    ps.saves_count,
    EXISTS(
      SELECT 1 FROM public.likes l
      WHERE l.post_id = p.id
      AND l.user_id = auth.uid()
    ) as user_has_liked
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$function$;

-- Update get_circle_feed function
CREATE OR REPLACE FUNCTION public.get_circle_feed(_circle_id uuid, page_num integer DEFAULT 0, page_size integer DEFAULT 10)
RETURNS TABLE(
  post_id uuid,
  content text,
  media_url text,
  media_urls text[],
  media_alt text,
  media_color_from text,
  media_color_to text,
  tags text[],
  is_sponsored boolean,
  created_at timestamp with time zone,
  user_id uuid,
  username text,
  name text,
  initials text,
  avatar_url text,
  avatar_color text,
  is_verified boolean,
  likes_count integer,
  comments_count integer,
  shares_count integer,
  saves_count integer,
  user_has_liked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    p.id as post_id,
    p.content,
    p.media_url,
    p.media_urls,
    p.media_alt,
    p.media_color_from,
    p.media_color_to,
    p.tags,
    p.is_sponsored,
    p.created_at,
    prof.id as user_id,
    prof.username,
    prof.name,
    prof.initials,
    prof.avatar_url,
    prof.avatar_color,
    prof.is_verified,
    ps.likes_count,
    ps.comments_count,
    ps.shares_count,
    ps.saves_count,
    EXISTS(
      SELECT 1 FROM public.likes l
      WHERE l.post_id = p.id AND l.user_id = auth.uid()
    ) as user_has_liked
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  WHERE p.circle_id = _circle_id
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$function$;