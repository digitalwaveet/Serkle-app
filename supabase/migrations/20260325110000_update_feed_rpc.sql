-- Update get_feed_posts to include new fields for PDF posts
DROP FUNCTION IF EXISTS public.get_feed_posts(integer, integer);

CREATE OR REPLACE FUNCTION public.get_feed_posts(
  page_num integer DEFAULT 0,
  page_size integer DEFAULT 10
)
RETURNS TABLE (
  post_id uuid,
  content text,
  media_url text,
  media_alt text,
  media_color_from text,
  media_color_to text,
  tags text[],
  is_sponsored boolean,
  created_at timestamptz,
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
  user_reaction text,
  post_type text,
  original_pdf_url text,
  media_urls text[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id AS post_id,
    p.content,
    p.media_url,
    p.media_alt,
    p.media_color_from,
    p.media_color_to,
    p.tags,
    p.is_sponsored,
    p.created_at,
    prof.id AS user_id,
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
    ) AS user_has_liked,
    (
      SELECT l.reaction_type FROM public.likes l
      WHERE l.post_id = p.id
      AND l.user_id = auth.uid()
      LIMIT 1
    ) AS user_reaction,
    p.post_type,
    p.original_pdf_url,
    p.media_urls
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$$;
