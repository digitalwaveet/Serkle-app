-- Preserve existing RPC signatures. Never return locked premium payloads from SECURITY DEFINER feeds.

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
  original_pdf_url text,
  visibility text,
  viewer_can_interact boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id as post_id,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.content ELSE '' END AS content,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.media_url END AS media_url,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.media_urls END AS media_urls,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.cover_image_url END AS cover_image_url,
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
      AND pu.user_id = auth.uid() AND pu.refunded_at IS NULL
    ) OR (p.circle_id IS NOT NULL AND public.circle_content_access('post', p.id, auth.uid())) as user_has_unlocked,
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
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.voice_url END AS voice_url,
    p.location_text,
    p.post_type,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.original_pdf_url END AS original_pdf_url,
    COALESCE(p.visibility, 'public') as visibility,
    (
      COALESCE(p.visibility, 'public') = 'public'
      OR p.user_id = auth.uid()
      OR public.is_post_audience(auth.uid(), p.user_id)
    ) as viewer_can_interact
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  LEFT JOIN public.circles c ON p.circle_id = c.id
  WHERE (p.circle_id IS NULL OR public.can_browse_circle(p.circle_id, auth.uid()) OR public.circle_content_access('post', p.id, auth.uid()))
    AND (
    COALESCE(p.visibility, 'public') = 'public'
    OR p.user_id = auth.uid()
    OR public.is_post_audience(auth.uid(), p.user_id)
  )
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$$;

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
  original_pdf_url text,
  visibility text,
  viewer_can_interact boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id as post_id,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.content ELSE '' END AS content,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.media_url END AS media_url,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.media_urls END AS media_urls,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.cover_image_url END AS cover_image_url,
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
      AND pu.user_id = auth.uid() AND pu.refunded_at IS NULL
    ) OR (p.circle_id IS NOT NULL AND public.circle_content_access('post', p.id, auth.uid())) as user_has_unlocked,
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
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.voice_url END AS voice_url,
    p.location_text,
    p.post_type,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.original_pdf_url END AS original_pdf_url,
    COALESCE(p.visibility, 'public') as visibility,
    (
      COALESCE(p.visibility, 'public') = 'public'
      OR p.user_id = auth.uid()
      OR public.is_post_audience(auth.uid(), p.user_id)
    ) as viewer_can_interact
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  LEFT JOIN public.circles c ON p.circle_id = c.id
  WHERE p.id = _post_id
    AND (p.circle_id IS NULL OR public.can_browse_circle(p.circle_id, auth.uid()) OR public.circle_content_access('post', p.id, auth.uid()))
    AND (
      COALESCE(p.visibility, 'public') = 'public'
      OR p.user_id = auth.uid()
      OR public.is_post_audience(auth.uid(), p.user_id)
      OR public.is_any_admin(auth.uid())
    );
$$;

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
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id as post_id,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.content ELSE '' END AS content,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.media_url END AS media_url,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.media_urls END AS media_urls,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.cover_image_url END AS cover_image_url,
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
      AND pu.user_id = auth.uid() AND pu.refunded_at IS NULL
    ) OR (p.circle_id IS NOT NULL AND public.circle_content_access('post', p.id, auth.uid())) as user_has_unlocked,
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
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.voice_url END AS voice_url,
    p.location_text,
    p.post_type,
    CASE WHEN (p.circle_id IS NULL OR public.circle_content_access('post', p.id, auth.uid())) THEN p.original_pdf_url END AS original_pdf_url,
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
    AND (public.can_browse_circle(p.circle_id, auth.uid()) OR public.circle_content_access('post', p.id, auth.uid()))
    AND (COALESCE(p.visibility, 'public') = 'public' OR p.user_id = auth.uid() OR public.is_post_audience(auth.uid(), p.user_id))
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$$;

NOTIFY pgrst, 'reload schema';
