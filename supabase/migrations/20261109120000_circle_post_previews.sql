BEGIN;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS circle_preview_text text CHECK (char_length(circle_preview_text) <= 280),
  ADD COLUMN IF NOT EXISTS circle_preview_cover text CHECK (
    char_length(circle_preview_cover) <= 100000
    AND circle_preview_cover ~ '^data:image/webp;base64,[A-Za-z0-9+/]+={0,2}$'
  ),
  ADD COLUMN IF NOT EXISTS circle_preview_thumb text CHECK (
    char_length(circle_preview_thumb) <= 2000
    AND circle_preview_thumb ~ '^data:image/webp;base64,[A-Za-z0-9+/]+={0,2}$'
  );

-- Some installations have the visibility column but predate the audience
-- helper from 20260627120000_friends_only_post_visibility.sql.
DO $install$
BEGIN
  IF to_regprocedure('public.is_post_audience(uuid,uuid)') IS NULL THEN
    CREATE FUNCTION public.is_post_audience(_viewer uuid, _author uuid)
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
    AS $audience$
      SELECT _viewer IS NOT NULL AND (
        _viewer = _author OR EXISTS (
          SELECT 1 FROM public.follows f
          WHERE (f.follower_id = _viewer AND f.following_id = _author)
             OR (f.follower_id = _author AND f.following_id = _viewer)
        )
      );
    $audience$;
  END IF;

  -- Keep the feed/detail signatures and preserve a newer preview RPC on retry.
  IF to_regprocedure('public.get_circle_post_previews(uuid,uuid[],boolean)') IS NULL THEN
    CREATE FUNCTION public.get_circle_post_previews(
      _circle_id uuid,
      _post_ids uuid[],
      _detail boolean DEFAULT false
    )
    RETURNS TABLE (
      post_id uuid,
      preview_text text,
      preview_image text,
      has_tips_enabled boolean
    )
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
    AS $preview$
      SELECT p.id,
        CASE WHEN p.is_premium THEN p.circle_preview_text END,
        CASE WHEN p.is_premium THEN
          CASE WHEN _detail THEN p.circle_preview_cover ELSE p.circle_preview_thumb END
        END,
        COALESCE(p.has_tips_enabled, true)
      FROM public.posts p
      WHERE cardinality(_post_ids) <= 50
        AND p.circle_id = _circle_id
        AND p.id = ANY (_post_ids)
        AND (public.can_browse_circle(p.circle_id, auth.uid()) OR public.circle_content_access('post', p.id, auth.uid()))
        AND (COALESCE(p.visibility, 'public') = 'public' OR p.user_id = auth.uid() OR public.is_post_audience(auth.uid(), p.user_id));
    $preview$;
  END IF;
END;
$install$;

REVOKE ALL ON FUNCTION public.get_circle_post_previews(uuid, uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_circle_post_previews(uuid, uuid[], boolean) TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
COMMIT;
