-- Atomically record a confirmed share on a visible post and return the persisted shares_count.
CREATE OR REPLACE FUNCTION public.increment_post_shares(_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _new_count integer;
  _can_view boolean;
BEGIN
  IF _post_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = _post_id
      AND (
        COALESCE(p.visibility, 'public') = 'public'
        OR p.user_id = auth.uid()
        OR (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.follows f
            WHERE (f.follower_id = auth.uid() AND f.following_id = p.user_id)
               OR (f.follower_id = p.user_id AND f.following_id = auth.uid())
          )
        )
      )
      AND (
        p.circle_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.circles c
          WHERE c.id = p.circle_id
            AND (NOT COALESCE(c.is_private, false) OR c.creator_id = auth.uid())
        )
        OR (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.circle_members cm
            WHERE cm.circle_id = p.circle_id
              AND cm.user_id = auth.uid()
              AND COALESCE(cm.status, 'active') = 'active'
          )
        )
      )
  ) INTO _can_view;

  IF NOT _can_view THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.post_stats (post_id, shares_count, updated_at)
  VALUES (_post_id, 1, now())
  ON CONFLICT (post_id) DO UPDATE
  SET
    shares_count = COALESCE(public.post_stats.shares_count, 0) + 1,
    updated_at = now()
  RETURNING shares_count INTO _new_count;

  RETURN _new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_post_shares(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_post_shares(uuid) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
