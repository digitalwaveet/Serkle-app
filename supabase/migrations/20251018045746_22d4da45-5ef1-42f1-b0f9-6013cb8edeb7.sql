-- Drop and recreate get_feed_posts to include cover_image_url
DROP FUNCTION IF EXISTS public.get_feed_posts(integer, integer);

CREATE FUNCTION public.get_feed_posts(page_num integer DEFAULT 0, page_size integer DEFAULT 10)
RETURNS TABLE(
  post_id uuid,
  content text,
  media_url text,
  media_urls text[],
  cover_image_url text,
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
  user_has_liked boolean,
  circle_id uuid,
  circle_name text,
  circle_avatar_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id as post_id,
    p.content,
    p.media_url,
    p.media_urls,
    p.cover_image_url,
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
    ) as user_has_liked,
    p.circle_id,
    c.name as circle_name,
    c.avatar_url as circle_avatar_url
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  LEFT JOIN public.circles c ON p.circle_id = c.id
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$function$;