-- Circle types, feature-driven navigation, pinned posts, richer stats
-- ---------------------------------------------------------------------------
-- Implements the "Circle Feature Feedback" foundation:
--   * circles.circle_type          — what kind of circle this is (drives layout)
--   * circles.enabled_features     — which sections the circle shows
--   * circles.target_audience      — "Who is this circle for?"
--   * circles.member_benefits      — "What will members receive?"
--   * circles.primary_language     — main language of the circle
--   * circles.is_online            — online vs local community
--   * posts.pinned_at (existing)   — reused for pinned posts inside a circle
--   * circle_stats.videos_count    — maintained by trigger like posts_count
--   * circle_stats.last_activity_at— "last active" signal for discovery cards

-- 1. Circle type + creation-flow fields --------------------------------------
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS circle_type text NOT NULL DEFAULT 'community',
  ADD COLUMN IF NOT EXISTS enabled_features text[] NOT NULL
    DEFAULT ARRAY['posts','videos','services','events','resources','messages'],
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS member_benefits text,
  ADD COLUMN IF NOT EXISTS primary_language text,
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'circles_circle_type_check'
  ) THEN
    ALTER TABLE public.circles
      ADD CONSTRAINT circles_circle_type_check CHECK (circle_type IN (
        'learning', 'community', 'consulting', 'business',
        'news', 'support_group', 'creator_club', 'local_community'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_circles_circle_type ON public.circles(circle_type);

-- 2. Pinned posts -------------------------------------------------------------
-- posts.pinned_at already exists (used by platform admins); pinned_at IS NOT
-- NULL is the app-wide "pinned" convention. Circle pins reuse it, scoped by
-- circle_id.
CREATE INDEX IF NOT EXISTS idx_posts_circle_pinned
  ON public.posts(circle_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;

-- Pinning is a moderation action by the circle creator/admin, who is usually
-- NOT the post author, so it cannot go through the normal posts UPDATE policy.
-- A SECURITY DEFINER RPC checks circle management rights itself.
CREATE OR REPLACE FUNCTION public.set_circle_post_pinned(_post_id uuid, _pinned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _circle_id uuid;
  _can_manage boolean;
BEGIN
  SELECT circle_id INTO _circle_id FROM public.posts WHERE id = _post_id;

  IF _circle_id IS NULL THEN
    RAISE EXCEPTION 'Post is not part of a circle';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.circles c WHERE c.id = _circle_id AND c.creator_id = auth.uid()
    UNION
    SELECT 1 FROM public.circle_members m
    WHERE m.circle_id = _circle_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('creator', 'admin')
  ) INTO _can_manage;

  IF NOT _can_manage THEN
    RAISE EXCEPTION 'Only circle admins can pin posts';
  END IF;

  UPDATE public.posts
  SET pinned_at = CASE WHEN _pinned THEN now() ELSE NULL END
  WHERE id = _post_id;
END;
$$;

-- 3. Richer circle stats -------------------------------------------------------
ALTER TABLE public.circle_stats
  ADD COLUMN IF NOT EXISTS videos_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Maintain videos_count exactly like posts_count
CREATE OR REPLACE FUNCTION public.update_circle_video_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.circle_stats
    SET videos_count = COALESCE(videos_count, 0) + 1,
        last_activity_at = now(),
        updated_at = now()
    WHERE circle_id = NEW.circle_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.circle_stats
    SET videos_count = GREATEST(COALESCE(videos_count, 0) - 1, 0),
        updated_at = now()
    WHERE circle_id = OLD.circle_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_circle_video_change ON public.circle_videos;
CREATE TRIGGER on_circle_video_change
  AFTER INSERT OR DELETE ON public.circle_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_circle_video_count();

-- Touch last_activity_at on new circle content
CREATE OR REPLACE FUNCTION public.touch_circle_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.circle_id IS NOT NULL THEN
    UPDATE public.circle_stats
    SET last_activity_at = now(), updated_at = now()
    WHERE circle_id = NEW.circle_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_circle_post_activity ON public.posts;
CREATE TRIGGER on_circle_post_activity
  AFTER INSERT ON public.posts
  FOR EACH ROW
  WHEN (NEW.circle_id IS NOT NULL)
  EXECUTE FUNCTION public.touch_circle_last_activity();

DROP TRIGGER IF EXISTS on_circle_event_activity ON public.circle_events;
CREATE TRIGGER on_circle_event_activity
  AFTER INSERT ON public.circle_events
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_circle_last_activity();

DROP TRIGGER IF EXISTS on_circle_resource_activity ON public.circle_resources;
CREATE TRIGGER on_circle_resource_activity
  AFTER INSERT ON public.circle_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_circle_last_activity();

-- 4. Backfill ------------------------------------------------------------------
UPDATE public.circle_stats cs
SET videos_count = sub.cnt
FROM (
  SELECT circle_id, COUNT(*)::integer AS cnt
  FROM public.circle_videos
  GROUP BY circle_id
) sub
WHERE cs.circle_id = sub.circle_id;

UPDATE public.circle_stats cs
SET last_activity_at = sub.latest
FROM (
  SELECT circle_id, MAX(created_at) AS latest
  FROM (
    SELECT circle_id, created_at FROM public.posts WHERE circle_id IS NOT NULL
    UNION ALL
    SELECT circle_id, created_at FROM public.circle_videos
    UNION ALL
    SELECT circle_id, created_at FROM public.circle_events
    UNION ALL
    SELECT circle_id, created_at FROM public.circle_resources
  ) activity
  GROUP BY circle_id
) sub
WHERE cs.circle_id = sub.circle_id;
