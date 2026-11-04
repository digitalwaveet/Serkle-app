-- Circle flow batch: member posting policy, approval notifications, search index
-- ---------------------------------------------------------------------------
--   * circles.posting_policy       — 'creator' (default) or 'members'
--   * can_post_in_circle + posts INSERT policy — the DB now enforces circle
--     posting rights (previously only the UI hid the composer)
--   * respond_circle_join_request  — approving now notifies the requester
--   * pg_trgm indexes              — server-side circle search stays fast

-- 1. Who can post in a circle -------------------------------------------------
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS posting_policy text NOT NULL DEFAULT 'creator';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'circles_posting_policy_check'
  ) THEN
    ALTER TABLE public.circles
      ADD CONSTRAINT circles_posting_policy_check
      CHECK (posting_policy IN ('creator', 'members'));
  END IF;
END $$;

-- True when _user may create a post inside _circle: the creator and admins
-- always can; regular active members only when the circle allows member posts.
CREATE OR REPLACE FUNCTION public.can_post_in_circle(_user uuid, _circle uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circles c
    LEFT JOIN public.circle_members m
      ON m.circle_id = c.id AND m.user_id = _user AND m.status = 'active'
    WHERE c.id = _circle
      AND (
        c.creator_id = _user
        OR m.role IN ('creator', 'admin')
        OR (COALESCE(c.posting_policy, 'creator') = 'members' AND m.user_id IS NOT NULL)
      )
  );
$$;

-- Harden the posts INSERT policy: personal posts unchanged, circle posts must
-- pass the circle's posting policy.
DROP POLICY IF EXISTS "posts_insert_policy" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
CREATE POLICY "posts_insert_policy"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    circle_id IS NULL
    OR public.can_post_in_circle(auth.uid(), circle_id)
  )
);

-- 2. Notify the requester when a join request is approved ----------------------
CREATE OR REPLACE FUNCTION public.respond_circle_join_request(
  _circle_id uuid,
  _user_id uuid,
  _approve boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _can_manage boolean;
  _circle_name text;
BEGIN
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
    RAISE EXCEPTION 'Only circle admins can respond to join requests';
  END IF;

  IF _approve THEN
    UPDATE public.circle_members
    SET status = 'active', joined_at = now()
    WHERE circle_id = _circle_id AND user_id = _user_id AND status = 'pending';

    IF FOUND THEN
      SELECT name INTO _circle_name FROM public.circles WHERE id = _circle_id;
      INSERT INTO public.push_notifications (user_id, title, body, notification_type, data, sent_at)
      VALUES (
        _user_id,
        'Request approved',
        'You are now a member of ' || COALESCE(_circle_name, 'the circle'),
        'circle_join_approved',
        jsonb_build_object('circle_id', _circle_id),
        now()
      );
    END IF;
  ELSE
    DELETE FROM public.circle_members
    WHERE circle_id = _circle_id AND user_id = _user_id AND status = 'pending';
  END IF;
END;
$$;

-- 3. Trigram indexes for server-side circle search -----------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_circles_name_trgm
  ON public.circles USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_circles_description_trgm
  ON public.circles USING gin (description gin_trgm_ops);
