BEGIN;

-- Ownership is an intrinsic entitlement. It must never depend on an unlock,
-- subscription, reconciliation job, or client-side state.
CREATE OR REPLACE FUNCTION public.circle_content_access(
  _kind text,
  _id uuid,
  _user uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _circle uuid;
  _owner uuid;
  _premium boolean;
  _bought boolean := false;
BEGIN
  IF _user IS NULL THEN
    RETURN false;
  END IF;

  IF _kind = 'post' THEN
    SELECT p.circle_id, p.user_id, COALESCE(p.is_premium, false)
      INTO _circle, _owner, _premium
    FROM public.posts p
    WHERE p.id = _id;
  ELSIF _kind = 'video' THEN
    SELECT v.circle_id, v.user_id, COALESCE(v.is_premium, false)
      INTO _circle, _owner, _premium
    FROM public.circle_videos v
    WHERE v.id = _id;
  ELSIF _kind = 'resource' THEN
    SELECT r.circle_id, r.uploader_id, COALESCE(r.is_premium, false)
      INTO _circle, _owner, _premium
    FROM public.circle_resources r
    WHERE r.id = _id;
  ELSE
    RETURN false;
  END IF;

  IF _owner IS NULL THEN
    RETURN false;
  END IF;

  -- Authors and Circle creators receive immediate server-authoritative access.
  IF _user = _owner OR (
    _circle IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.id = _circle AND c.creator_id = _user
    )
  ) THEN
    RETURN true;
  END IF;

  IF _kind = 'post' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.post_unlocks u
      WHERE u.post_id = _id
        AND u.user_id = _user
        AND u.refunded_at IS NULL
        AND (u.payment_id IS NULL OR public.circle_receipt_paid(u.payment_id, _user, 'post', _id))
    ) INTO _bought;
  ELSIF _kind = 'video' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.video_unlocks u
      WHERE u.video_id = _id
        AND u.user_id = _user
        AND u.refunded_at IS NULL
        AND (u.payment_id IS NULL OR public.circle_receipt_paid(u.payment_id, _user, 'video', _id))
    ) INTO _bought;
  END IF;

  IF _bought THEN
    RETURN true;
  END IF;
  IF _circle IS NULL THEN
    RETURN NOT _premium;
  END IF;

  RETURN public.can_browse_circle(_circle, _user)
    AND (NOT _premium OR public.has_circle_subscription(_circle, _user));
END;
$$;

COMMENT ON FUNCTION public.circle_content_access(text, uuid, uuid) IS
  'Authoritative Circle entitlement. Authors and Circle creators always have immediate access; buyers require an active verified grant.';

NOTIFY pgrst, 'reload schema';
COMMIT;
