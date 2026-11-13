-- Keep a Circle coin payment and its entitlement in the same confirmed
-- transaction. A successful response must never mean "coins moved but the
-- content is still locked".
CREATE OR REPLACE FUNCTION public.purchase_circle_access(
  _kind text,
  _target_id uuid,
  _request_id uuid,
  _renew boolean DEFAULT false,
  _expected_expires_at timestamptz DEFAULT NULL,
  _expected_price integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _result jsonb;
  _access boolean := false;
  _paid circle_payment_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Restore any grant whose durable debit exists before considering another
  -- charge. This also repairs purchases made by older app versions.
  PERFORM public.reconcile_circle_receipts(auth.uid());

  IF _kind IN ('post', 'video') THEN
    SELECT p.* INTO _paid
    FROM public.circle_payment_requests p
    WHERE p.user_id = auth.uid()
      AND p.kind = _kind
      AND p.target_id = _target_id
      AND p.amount > 0
      AND p.refunded_at IS NULL
      AND public.circle_receipt_paid(p.id, p.user_id, p.kind, p.target_id)
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 1;

    IF FOUND THEN
      _access := public.circle_content_access(_kind, _target_id, auth.uid());
      IF NOT _access THEN
        RAISE EXCEPTION 'A previous payment exists but access could not be restored. No additional coins were charged.';
      END IF;
      RETURN jsonb_build_object(
        'payment_id', _paid.id,
        'charged', 0,
        'replayed', true,
        'recovered', true,
        'refunded', false,
        'has_access', true
      );
    END IF;
  END IF;

  _result := public.purchase_circle_access_paid(
    _kind, _target_id, _request_id, _renew, _expected_expires_at, _expected_price
  );

  -- Replaying an explicitly refunded request is not a new purchase. Preserve
  -- that terminal response so the client can require fresh price consent.
  IF COALESCE((_result->>'refunded')::boolean, false) THEN
    RETURN jsonb_set(_result, '{has_access}', 'false'::jsonb, true);
  END IF;

  -- Confirm the grant through the same backend predicate used by the readers.
  -- Raising here rolls the entire new debit, credit, receipt and grant back.
  PERFORM public.reconcile_circle_receipts(auth.uid());
  _access := CASE
    WHEN _kind = 'subscription' THEN public.has_circle_subscription(_target_id, auth.uid())
    ELSE public.circle_content_access(_kind, _target_id, auth.uid())
  END;
  IF NOT _access THEN
    RAISE EXCEPTION 'Purchase could not be confirmed. No coins were charged.';
  END IF;

  RETURN jsonb_set(_result, '{has_access}', 'true'::jsonb, true);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_circle_access(text, uuid, uuid, boolean, timestamptz, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_circle_access(text, uuid, uuid, boolean, timestamptz, integer)
  TO authenticated;

-- A signed-in Circle viewer may request one missing, deliberately low-quality
-- premium cover preview. The original still travels only through a short-lived
-- signed URL held by the trusted image processor.
CREATE OR REPLACE FUNCTION public.claim_circle_cover_preview_for_viewer(
  _post_id uuid,
  _origin text
)
RETURNS TABLE (post_id uuid, lease uuid, object_path text, original_bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user uuid := auth.uid();
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT p.id, o.name, (o.metadata->>'size')::bigint AS bytes
    FROM public.posts p
    CROSS JOIN LATERAL (
      SELECT COALESCE(NULLIF(p.cover_image_url, ''), NULLIF(p.media_url, ''), p.media_urls[1]) AS url
    ) source
    JOIN storage.objects o
      ON o.bucket_id = 'post-media'
      AND o.name = public.circle_storage_path(source.url, 'post-media')
      AND (
        o.owner_id = p.user_id::text
        OR (NULLIF(o.owner_id, '') IS NULL AND split_part(o.name, '/', 1) = p.user_id::text)
      )
    WHERE p.id = _post_id
      AND p.circle_id IS NOT NULL
      AND p.is_premium
      AND public.can_browse_circle(p.circle_id, _user)
      AND (COALESCE(p.visibility, 'public') = 'public' OR p.user_id = _user OR public.is_post_audience(_user, p.user_id))
      AND (p.circle_preview_cover IS NULL OR p.circle_preview_thumb IS NULL)
      AND (p.circle_preview_retry_at IS NULL OR p.circle_preview_retry_at <= now())
      AND (
        starts_with(source.url, _origin || '/storage/v1/object/public/post-media/')
        OR starts_with(source.url, _origin || '/storage/v1/object/sign/post-media/')
        OR starts_with(source.url, _origin || '/storage/v1/object/authenticated/post-media/')
      )
      AND o.metadata->>'mimetype' IN (
        'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic',
        'image/heif', 'image/gif', 'image/bmp', 'image/tiff'
      )
      AND CASE
        WHEN o.metadata->>'size' ~ '^[0-9]{1,8}$'
          THEN (o.metadata->>'size')::bigint BETWEEN 1 AND 52428800
        ELSE false
      END
    FOR UPDATE OF p SKIP LOCKED
  )
  UPDATE public.posts p
  SET circle_preview_lease = gen_random_uuid(),
      circle_preview_retry_at = now() + interval '10 minutes'
  FROM candidate c
  WHERE p.id = c.id
  RETURNING p.id, p.circle_preview_lease, c.name, c.bytes;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_complete_circle_cover_preview(
  _post_id uuid,
  _lease uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = _post_id
      AND p.circle_id IS NOT NULL
      AND p.is_premium
      AND p.circle_preview_lease = _lease
      AND p.circle_preview_retry_at > now()
      AND public.can_browse_circle(p.circle_id, auth.uid())
      AND (COALESCE(p.visibility, 'public') = 'public' OR p.user_id = auth.uid() OR public.is_post_audience(auth.uid(), p.user_id))
  );
$$;

REVOKE ALL ON FUNCTION public.claim_circle_cover_preview_for_viewer(uuid, text),
  public.can_complete_circle_cover_preview(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_circle_cover_preview_for_viewer(uuid, text),
  public.can_complete_circle_cover_preview(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
