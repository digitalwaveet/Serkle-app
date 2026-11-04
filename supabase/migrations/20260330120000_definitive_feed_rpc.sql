-- Definitive update for get_feed_posts to consolidate all required fields
DROP FUNCTION IF EXISTS public.get_feed_posts(integer, integer);

CREATE OR REPLACE FUNCTION public.get_feed_posts(
  page_num integer DEFAULT 0,
  page_size integer DEFAULT 10
)
RETURNS TABLE (
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
  user_has_unlocked boolean,
  user_has_saved boolean,
  circle_id uuid,
  circle_name text,
  circle_avatar_url text,
  is_premium boolean,
  premium_price decimal,
  voice_url text,
  location_text text,
  post_type text,
  original_pdf_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    (
      SELECT l.reaction_type FROM public.likes l
      WHERE l.post_id = p.id
      AND l.user_id = auth.uid()
      LIMIT 1
    ) AS user_reaction,
    EXISTS(
      SELECT 1 FROM public.post_unlocks pu
      WHERE pu.post_id = p.id
      AND pu.user_id = auth.uid()
    ) as user_has_unlocked,
    EXISTS(
      SELECT 1 FROM public.saves s
      WHERE s.post_id = p.id
      AND s.user_id = auth.uid()
    ) as user_has_saved,
    p.circle_id,
    c.name as circle_name,
    c.avatar_url as circle_avatar_url,
    COALESCE(p.is_premium, false) as is_premium,
    p.premium_price,
    p.voice_url,
    p.location_text,
    p.post_type,
    p.original_pdf_url
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  LEFT JOIN public.circles c ON p.circle_id = c.id
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$$;

-- Add a companion function for single post fetching
CREATE OR REPLACE FUNCTION public.get_post_details(
  _post_id uuid
)
RETURNS TABLE (
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
  user_has_unlocked boolean,
  user_has_saved boolean,
  circle_id uuid,
  circle_name text,
  circle_avatar_url text,
  is_premium boolean,
  premium_price decimal,
  voice_url text,
  location_text text,
  post_type text,
  original_pdf_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    (
      SELECT l.reaction_type FROM public.likes l
      WHERE l.post_id = p.id
      AND l.user_id = auth.uid()
      LIMIT 1
    ) AS user_reaction,
    EXISTS(
      SELECT 1 FROM public.post_unlocks pu
      WHERE pu.post_id = p.id
      AND pu.user_id = auth.uid()
    ) as user_has_unlocked,
    EXISTS(
      SELECT 1 FROM public.saves s
      WHERE s.post_id = p.id
      AND s.user_id = auth.uid()
    ) as user_has_saved,
    p.circle_id,
    c.name as circle_name,
    c.avatar_url as circle_avatar_url,
    COALESCE(p.is_premium, false) as is_premium,
    p.premium_price,
    p.voice_url,
    p.location_text,
    p.post_type,
    p.original_pdf_url
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  LEFT JOIN public.circles c ON p.circle_id = c.id
  WHERE p.id = _post_id;
$$;

-- Add a companion function for circle post fetching
CREATE OR REPLACE FUNCTION public.get_circle_posts_definitive(
  _circle_id uuid,
  page_num integer DEFAULT 0,
  page_size integer DEFAULT 10
)
RETURNS TABLE (
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
  user_has_unlocked boolean,
  user_has_saved boolean,
  circle_id uuid,
  circle_name text,
  circle_avatar_url text,
  is_premium boolean,
  premium_price decimal,
  voice_url text,
  location_text text,
  post_type text,
  original_pdf_url text,
  tip_count integer,
  user_has_tipped boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    (
      SELECT l.reaction_type FROM public.likes l
      WHERE l.post_id = p.id
      AND l.user_id = auth.uid()
      LIMIT 1
    ) AS user_reaction,
    EXISTS(
      SELECT 1 FROM public.post_unlocks pu
      WHERE pu.post_id = p.id
      AND pu.user_id = auth.uid()
    ) as user_has_unlocked,
    EXISTS(
      SELECT 1 FROM public.saves s
      WHERE s.post_id = p.id
      AND s.user_id = auth.uid()
    ) as user_has_saved,
    p.circle_id,
    c.name as circle_name,
    c.avatar_url as circle_avatar_url,
    COALESCE(p.is_premium, false) as is_premium,
    p.premium_price,
    p.voice_url,
    p.location_text,
    p.post_type,
    p.original_pdf_url,
    (
      SELECT COUNT(*)::integer FROM public.circle_tips ct
      WHERE ct.post_id = p.id
    ) as tip_count,
    EXISTS(
      SELECT 1 FROM public.circle_tips ct
      WHERE ct.post_id = p.id
      AND ct.tipper_id = auth.uid()
    ) as user_has_tipped
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  LEFT JOIN public.circles c ON p.circle_id = c.id
  WHERE p.circle_id = _circle_id
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$$;
