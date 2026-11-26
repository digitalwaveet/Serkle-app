-- Ensure every Relax video has a video_stats row and accurate persisted save/share counts.
INSERT INTO public.video_stats (video_id)
SELECT v.id
FROM public.videos v
LEFT JOIN public.video_stats vs ON vs.video_id = v.id
WHERE vs.video_id IS NULL
ON CONFLICT (video_id) DO NOTHING;

UPDATE public.video_stats
SET
  likes_count = COALESCE(likes_count, 0),
  comments_count = COALESCE(comments_count, 0),
  shares_count = COALESCE(shares_count, 0),
  saves_count = COALESCE(saves_count, 0),
  views_count = COALESCE(views_count, 0),
  updated_at = now()
WHERE likes_count IS NULL
   OR comments_count IS NULL
   OR shares_count IS NULL
   OR saves_count IS NULL
   OR views_count IS NULL;

-- Reconcile persisted saves_count with actual rows in public.video_saves.
UPDATE public.video_stats vs
SET
  saves_count = counts.actual_saves,
  updated_at = now()
FROM (
  SELECT
    v.id AS video_id,
    COUNT(vsv.id)::integer AS actual_saves
  FROM public.videos v
  LEFT JOIN public.video_saves vsv ON vsv.video_id = v.id
  GROUP BY v.id
) counts
WHERE vs.video_id = counts.video_id
  AND COALESCE(vs.saves_count, -1) <> counts.actual_saves;

-- Harden video_saves trigger so inserts create missing video_stats rows and deletes never go negative.
CREATE OR REPLACE FUNCTION public.update_video_saves_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.video_stats (video_id, saves_count, updated_at)
    VALUES (NEW.video_id, 1, now())
    ON CONFLICT (video_id) DO UPDATE
    SET
      saves_count = COALESCE(public.video_stats.saves_count, 0) + 1,
      updated_at = now();
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.video_stats
    SET
      saves_count = GREATEST(0, COALESCE(saves_count, 0) - 1),
      updated_at = now()
    WHERE video_id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_video_save_change ON public.video_saves;
CREATE TRIGGER on_video_save_change
  AFTER INSERT OR DELETE ON public.video_saves
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_saves_count();

-- Atomically record a confirmed share on a Relax video and return the persisted shares_count.
-- Named distinctly from public.increment_video_shares(uuid) which targets circle_videos.
CREATE OR REPLACE FUNCTION public.increment_relax_video_shares(_video_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _new_count integer;
BEGIN
  IF _video_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.videos v
    WHERE v.id = _video_id
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.video_stats (video_id, shares_count, updated_at)
  VALUES (_video_id, 1, now())
  ON CONFLICT (video_id) DO UPDATE
  SET
    shares_count = COALESCE(public.video_stats.shares_count, 0) + 1,
    updated_at = now()
  RETURNING shares_count INTO _new_count;

  RETURN _new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_relax_video_shares(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_relax_video_shares(uuid) TO authenticated, anon;

-- Ensure get_video_feed never drops videos missing a stats row and never returns NULL counts.
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
SET search_path = public, pg_temp
AS $$
  SELECT
    v.id AS video_id,
    prof.id AS user_id,
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
    COALESCE(vs.likes_count, 0) AS likes_count,
    COALESCE(vs.comments_count, 0) AS comments_count,
    COALESCE(vs.shares_count, 0) AS shares_count,
    COALESCE(vs.saves_count, 0) AS saves_count,
    COALESCE(vs.views_count, 0) AS views_count,
    EXISTS(
      SELECT 1 FROM public.video_likes vl
      WHERE vl.video_id = v.id AND vl.user_id = auth.uid()
    ) AS user_has_liked,
    EXISTS(
      SELECT 1 FROM public.video_saves vsv
      WHERE vsv.video_id = v.id AND vsv.user_id = auth.uid()
    ) AS user_has_saved
  FROM public.videos v
  INNER JOIN public.profiles prof ON v.user_id = prof.id
  LEFT JOIN public.video_stats vs ON v.id = vs.video_id
  ORDER BY v.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$$;

NOTIFY pgrst, 'reload schema';
