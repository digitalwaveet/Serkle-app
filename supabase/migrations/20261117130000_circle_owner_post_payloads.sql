BEGIN;

-- Repeat the intrinsic owner grant so this repair is safe to deploy even when
-- an installation missed the preceding owner-access migration.
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
  IF _user IS NULL THEN RETURN false; END IF;

  IF _kind = 'post' THEN
    SELECT p.circle_id, p.user_id, COALESCE(p.is_premium, false)
      INTO _circle, _owner, _premium FROM public.posts p WHERE p.id = _id;
  ELSIF _kind = 'video' THEN
    SELECT v.circle_id, v.user_id, COALESCE(v.is_premium, false)
      INTO _circle, _owner, _premium FROM public.circle_videos v WHERE v.id = _id;
  ELSIF _kind = 'resource' THEN
    SELECT r.circle_id, r.uploader_id, COALESCE(r.is_premium, false)
      INTO _circle, _owner, _premium FROM public.circle_resources r WHERE r.id = _id;
  ELSE
    RETURN false;
  END IF;

  IF _owner IS NULL THEN RETURN false; END IF;
  IF _user = _owner OR (
    _circle IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.circles c WHERE c.id = _circle AND c.creator_id = _user
    )
  ) THEN
    RETURN true;
  END IF;

  IF _kind = 'post' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.post_unlocks u
      WHERE u.post_id = _id AND u.user_id = _user AND u.refunded_at IS NULL
        AND (u.payment_id IS NULL OR public.circle_receipt_paid(u.payment_id, _user, 'post', _id))
    ) INTO _bought;
  ELSIF _kind = 'video' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.video_unlocks u
      WHERE u.video_id = _id AND u.user_id = _user AND u.refunded_at IS NULL
        AND (u.payment_id IS NULL OR public.circle_receipt_paid(u.payment_id, _user, 'video', _id))
    ) INTO _bought;
  END IF;

  IF _bought THEN RETURN true; END IF;
  IF _circle IS NULL THEN RETURN NOT _premium; END IF;
  RETURN public.can_browse_circle(_circle, _user)
    AND (NOT _premium OR public.has_circle_subscription(_circle, _user));
END;
$$;

-- This narrowly scoped RPC repairs installations whose historical post-detail
-- RPC still redacts owners. It never returns a payload to an unrelated viewer.
CREATE OR REPLACE FUNCTION public.get_owned_circle_post_payloads(_post_ids uuid[])
RETURNS TABLE (
  post_id uuid,
  content text,
  media_url text,
  media_urls text[],
  cover_image_url text,
  voice_url text,
  original_pdf_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id,
    p.content,
    p.media_url,
    p.media_urls,
    p.cover_image_url,
    p.voice_url,
    p.original_pdf_url
  FROM public.posts p
  LEFT JOIN public.circles c ON c.id = p.circle_id
  WHERE auth.uid() IS NOT NULL
    AND cardinality(_post_ids) BETWEEN 1 AND 50
    AND p.id = ANY (_post_ids)
    AND p.circle_id IS NOT NULL
    AND (p.user_id = auth.uid() OR c.creator_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_owned_circle_post_payloads(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owned_circle_post_payloads(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
