ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS circle_headline text,
  ADD COLUMN IF NOT EXISTS circle_preview_full_frame boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.posts'::regclass AND conname = 'circle_post_headline_valid'
  ) THEN
    ALTER TABLE public.posts ADD CONSTRAINT circle_post_headline_valid CHECK (
      circle_headline IS NULL OR (
        circle_id IS NOT NULL AND char_length(btrim(circle_headline)) BETWEEN 1 AND 120
        AND circle_headline !~ '[[:cntrl:]]'
      )
    );
  END IF;
END;
$$;

-- Keep the original RPC's return type intact for installed versions of the app.
CREATE OR REPLACE FUNCTION public.get_circle_post_previews_v2(
  _circle_id uuid, _post_ids uuid[], _detail boolean DEFAULT false
)
RETURNS TABLE (
  post_id uuid, headline text, preview_text text, preview_image text,
  full_frame boolean, has_tips_enabled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.id, p.circle_headline,
    CASE WHEN p.is_premium AND _detail THEN public.circle_post_teaser(p.content) END,
    CASE WHEN p.is_premium THEN p.circle_preview_cover END,
    p.circle_preview_full_frame,
    COALESCE(p.has_tips_enabled, true)
  FROM public.posts p
  WHERE cardinality(_post_ids) <= 50
    AND p.circle_id = _circle_id AND p.id = ANY (_post_ids)
    AND (public.can_browse_circle(p.circle_id, auth.uid()) OR public.circle_content_access('post', p.id, auth.uid()))
    AND (COALESCE(p.visibility, 'public') = 'public' OR p.user_id = auth.uid() OR public.is_post_audience(auth.uid(), p.user_id));
$$;

REVOKE ALL ON FUNCTION public.get_circle_post_previews_v2(uuid, uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_circle_post_previews_v2(uuid, uuid[], boolean) TO authenticated, anon;

-- Reuse the existing lease/ownership checks and job queue. Versioned jobs may
-- regenerate legacy crops without removing the existing preview during processing.
CREATE OR REPLACE FUNCTION public.claim_circle_full_frame_preview(_origin text, _post_id uuid, _viewer uuid)
RETURNS TABLE (post_id uuid, lease uuid, object_path text, original_bytes bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH candidate AS (
    SELECT p.id, o.name, (o.metadata->>'size')::bigint AS bytes
    FROM public.posts p
    CROSS JOIN LATERAL (
      SELECT COALESCE(NULLIF(p.cover_image_url, ''), NULLIF(p.media_url, ''), p.media_urls[1]) AS url
    ) source
    JOIN storage.objects o ON o.bucket_id = 'post-media'
      AND o.name = public.circle_storage_path(source.url, 'post-media')
      AND (o.owner_id = p.user_id::text OR (NULLIF(o.owner_id, '') IS NULL AND split_part(o.name, '/', 1) = p.user_id::text))
    WHERE p.circle_id IS NOT NULL AND p.is_premium
      AND (NOT p.circle_preview_full_frame OR p.circle_preview_cover IS NULL OR p.circle_preview_thumb IS NULL)
      AND (p.circle_preview_retry_at IS NULL OR p.circle_preview_retry_at <= now())
      AND (_post_id IS NULL OR p.id = _post_id)
      AND (_viewer IS NULL OR (
        public.can_browse_circle(p.circle_id, _viewer)
        AND (COALESCE(p.visibility, 'public') = 'public' OR p.user_id = _viewer OR public.is_post_audience(_viewer, p.user_id))
      ))
      AND (
        starts_with(source.url, _origin || '/storage/v1/object/public/post-media/')
        OR starts_with(source.url, _origin || '/storage/v1/object/sign/post-media/')
        OR starts_with(source.url, _origin || '/storage/v1/object/authenticated/post-media/')
      )
      AND o.metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/gif', 'image/bmp', 'image/tiff')
      AND CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,8}$' THEN (o.metadata->>'size')::bigint BETWEEN 1 AND 52428800 ELSE false END
    ORDER BY p.circle_preview_retry_at NULLS FIRST, p.created_at, p.id
    LIMIT 1 FOR UPDATE OF p SKIP LOCKED
  )
  UPDATE public.posts p
    SET circle_preview_lease = gen_random_uuid(), circle_preview_retry_at = now() + interval '10 minutes'
  FROM candidate c WHERE p.id = c.id
  RETURNING p.id, p.circle_preview_lease, c.name, c.bytes;
$$;

CREATE OR REPLACE FUNCTION public.complete_circle_full_frame_preview(_post_id uuid, _lease uuid, _cover text, _thumb text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH completed AS (
    UPDATE public.posts SET circle_preview_cover = _cover, circle_preview_thumb = _thumb,
      circle_preview_full_frame = true, circle_preview_lease = NULL, circle_preview_retry_at = NULL
    WHERE id = _post_id AND circle_id IS NOT NULL AND is_premium AND circle_preview_lease = _lease
      AND circle_preview_retry_at > now() AND _cover IS NOT NULL AND _thumb IS NOT NULL
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM completed);
$$;

REVOKE ALL ON FUNCTION public.claim_circle_full_frame_preview(text, uuid, uuid),
  public.complete_circle_full_frame_preview(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_circle_full_frame_preview(text, uuid, uuid),
  public.complete_circle_full_frame_preview(uuid, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_circle_cover_preview()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (NEW.cover_image_url, NEW.media_url, NEW.media_urls, NEW.is_premium, NEW.circle_id, NEW.user_id)
      IS DISTINCT FROM (OLD.cover_image_url, OLD.media_url, OLD.media_urls, OLD.is_premium, OLD.circle_id, OLD.user_id) THEN
    NEW.circle_preview_lease := NULL;
    NEW.circle_preview_retry_at := NULL;
    IF (NEW.circle_preview_cover, NEW.circle_preview_thumb) IS NOT DISTINCT FROM (OLD.circle_preview_cover, OLD.circle_preview_thumb) THEN
      NEW.circle_preview_cover := NULL;
      NEW.circle_preview_thumb := NULL;
      NEW.circle_preview_full_frame := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
