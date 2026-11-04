-- Friends-Only post visibility
-- ---------------------------------------------------------------------------
-- Adds a `visibility` column to posts ('public' | 'friends'). A friends-only
-- post is only viewable and interactable by:
--   * the author,
--   * the author's connections (people who follow them OR whom they follow),
--   * admins/moderators (for moderation only — they cannot interact).
-- Enforcement happens at the database layer (RLS + the feed/detail RPCs) so it
-- holds regardless of which client read path is used.

-- 1. Column + constraint ----------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_visibility_check'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_visibility_check CHECK (visibility IN ('public', 'friends'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility);

-- 2. Audience helper --------------------------------------------------------
-- True when the viewer is the author, or there is a follow relationship in
-- EITHER direction. This is the inclusive reading of "friends or followers":
-- "followers" follow the author; "friends" follow each other (mutual). If you
-- want to restrict this to people who follow the author only, drop the second
-- OR branch below.
CREATE OR REPLACE FUNCTION public.is_post_audience(_viewer uuid, _author uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _viewer IS NOT NULL
    AND (
      _viewer = _author
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE (f.follower_id = _viewer AND f.following_id = _author)
           OR (f.follower_id = _author AND f.following_id = _viewer)
      )
    );
$$;

-- 3. Tighten the posts SELECT policy ---------------------------------------
-- Public posts stay visible to everyone (including anonymous). Friends-only
-- posts are limited to the author, their audience, and admins.
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Posts are viewable by audience" ON public.posts;
CREATE POLICY "Posts are viewable by audience"
  ON public.posts FOR SELECT
  USING (
    COALESCE(visibility, 'public') = 'public'
    OR auth.uid() = user_id
    OR public.is_post_audience(auth.uid(), user_id)
    OR public.is_any_admin(auth.uid())
  );

-- 4. Gate commenting on friends-only posts ----------------------------------
-- A user may only comment if they can interact with the post (author or
-- audience). Admins are intentionally NOT granted comment rights here.
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comments.post_id
        AND (
          COALESCE(p.visibility, 'public') = 'public'
          OR p.user_id = auth.uid()
          OR public.is_post_audience(auth.uid(), p.user_id)
        )
    )
  );

-- 5. Gate liking/reacting on friends-only posts -----------------------------
DROP POLICY IF EXISTS "Authenticated users can like posts" ON public.likes;
CREATE POLICY "Authenticated users can like posts"
  ON public.likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = likes.post_id
        AND (
          COALESCE(p.visibility, 'public') = 'public'
          OR p.user_id = auth.uid()
          OR public.is_post_audience(auth.uid(), p.user_id)
        )
    )
  );

-- 6. Feed RPC: filter out friends-only posts the viewer can't see -----------
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
  original_pdf_url text,
  visibility text,
  viewer_can_interact boolean
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
  WHERE (
    COALESCE(p.visibility, 'public') = 'public'
    OR p.user_id = auth.uid()
    OR public.is_post_audience(auth.uid(), p.user_id)
  )
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$$;

-- 7. Detail RPC: same filter (admins may still open for moderation) ---------
DROP FUNCTION IF EXISTS public.get_post_details(uuid);

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
    AND (
      COALESCE(p.visibility, 'public') = 'public'
      OR p.user_id = auth.uid()
      OR public.is_post_audience(auth.uid(), p.user_id)
      OR public.is_any_admin(auth.uid())
    );
$$;
