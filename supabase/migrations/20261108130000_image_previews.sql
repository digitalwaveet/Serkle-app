BEGIN;

INSERT INTO storage.buckets(id,name,public) VALUES('post-media','post-media',false),('chat-media','chat-media',false)
  ON CONFLICT(id) DO UPDATE SET public=false;

-- Keep stable original references in posts/messages. Derivatives are private
-- siblings of that object and inherit its conversation/Circle permissions.
CREATE TABLE IF NOT EXISTS public.media_image_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  bucket_id text NOT NULL CHECK(bucket_id IN ('chat-media','post-media')),
  original_path text NOT NULL,
  original_name text NOT NULL,
  original_mime text NOT NULL,
  original_bytes bigint NOT NULL CHECK(original_bytes > 0 AND original_bytes <= 52428800),
  original_sha256 text,
  width integer, height integer,
  animated boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','ready','failed')),
  variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bucket_id,original_path)
);
CREATE INDEX IF NOT EXISTS media_image_pending ON public.media_image_assets(next_attempt_at) WHERE status <> 'ready';
ALTER TABLE public.media_image_assets ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
ALTER TABLE public.media_image_assets ENABLE ROW LEVEL SECURITY;

-- This helper reads as the table owner to avoid storage/metadata RLS recursion.
-- Access decisions use the existing authoritative chat and Circle helpers.
CREATE OR REPLACE FUNCTION public.can_read_image_asset(p_bucket text,p_original text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE asset public.media_image_assets%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=p_bucket AND name=p_original) THEN RETURN false; END IF;
  IF p_bucket='chat-media' THEN RETURN public.can_access_chat_object(p_original); END IF;
  IF p_bucket='post-media' THEN
    SELECT * INTO asset FROM public.media_image_assets WHERE bucket_id=p_bucket AND original_path=p_original;
    IF asset.id IS NOT NULL AND NOT asset.is_published AND asset.owner_id<>auth.uid() THEN RETURN false; END IF;
    RETURN public.can_read_circle_storage(p_bucket,p_original,auth.uid());
  END IF;
  RETURN false;
END; $$;
DROP POLICY IF EXISTS image_assets_read ON public.media_image_assets;
CREATE POLICY image_assets_read ON public.media_image_assets FOR SELECT TO authenticated
  USING(public.can_read_image_asset(bucket_id,original_path));
REVOKE ALL ON public.media_image_assets FROM anon,authenticated;
GRANT SELECT ON public.media_image_assets TO authenticated;
GRANT ALL ON public.media_image_assets TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_image_asset(p_bucket text,p_path text,p_name text,p_mime text,p_sha256 text,p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE object_row storage.objects%ROWTYPE; asset public.media_image_assets%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_bucket NOT IN ('chat-media','post-media') OR p_path LIKE '%.__serkle_preview_%'
    OR p_operation IS NULL OR p_sha256 IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$'
    OR p_mime NOT IN ('image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif','image/gif','image/bmp','image/tiff')
    THEN RAISE EXCEPTION 'Invalid image upload' USING ERRCODE='22023'; END IF;
  SELECT * INTO object_row FROM storage.objects WHERE bucket_id=p_bucket AND name=p_path;
  IF object_row.id IS NULL OR object_row.owner_id IS DISTINCT FROM auth.uid()::text
    OR NOT public.can_read_image_asset(p_bucket,p_path)
    OR (p_bucket='chat-media' AND NOT public.can_access_chat_object(p_path,true))
    OR (p_bucket='post-media' AND split_part(p_path,'/',1)<>auth.uid()::text)
    THEN RAISE EXCEPTION 'Image upload unavailable' USING ERRCODE='42501'; END IF;
  INSERT INTO public.media_image_assets(owner_id,bucket_id,original_path,original_name,original_mime,original_bytes,original_sha256)
    VALUES(auth.uid(),p_bucket,p_path,left(p_name,255),p_mime,(object_row.metadata->>'size')::bigint,p_sha256)
    ON CONFLICT(bucket_id,original_path) DO NOTHING;
  SELECT * INTO asset FROM public.media_image_assets WHERE bucket_id=p_bucket AND original_path=p_path FOR UPDATE;
  IF asset.owner_id<>auth.uid() OR asset.original_sha256 IS DISTINCT FROM p_sha256 THEN
    RAISE EXCEPTION 'Image upload conflict' USING ERRCODE='42501'; END IF;
  IF asset.status='ready' THEN RETURN to_jsonb(asset); END IF;
  IF asset.status='processing' AND asset.processing_token<>p_operation AND asset.lease_until>now() THEN
    RAISE EXCEPTION 'Image is already processing' USING ERRCODE='55000'; END IF;
  UPDATE public.media_image_assets SET status='processing',processing_token=p_operation,
    lease_until=now()+interval '5 minutes',attempts=attempts+1,last_error=NULL,updated_at=now()
    WHERE id=asset.id RETURNING * INTO asset;
  RETURN to_jsonb(asset);
END; $$;

CREATE OR REPLACE FUNCTION public.complete_image_asset(p_id uuid,p_token uuid,p_width integer,p_height integer,p_variants jsonb,p_animated boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE asset public.media_image_assets%ROWTYPE; kind text; variant jsonb; expected text; object_row storage.objects%ROWTYPE; checked jsonb:='{}'; edge integer;
BEGIN
  SELECT * INTO asset FROM public.media_image_assets WHERE id=p_id FOR UPDATE;
  IF asset.id IS NULL OR (auth.role()<>'service_role' AND (asset.owner_id IS DISTINCT FROM auth.uid() OR NOT public.can_read_image_asset(asset.bucket_id,asset.original_path))) THEN
    RAISE EXCEPTION 'Image unavailable' USING ERRCODE='42501'; END IF;
  IF asset.status='ready' THEN RETURN to_jsonb(asset); END IF;
  IF p_token IS DISTINCT FROM asset.processing_token OR asset.status<>'processing' THEN
    RAISE EXCEPTION 'Image processing lease expired' USING ERRCODE='55000'; END IF;
  IF p_width IS NULL OR p_height IS NULL OR p_width<1 OR p_height<1 OR p_width::bigint*p_height>50000000 THEN
    RAISE EXCEPTION 'Invalid image dimensions' USING ERRCODE='22023'; END IF;
  FOREACH kind IN ARRAY ARRAY['thumb','display','full'] LOOP
    variant:=p_variants->kind;
    expected:=asset.original_path||'.__serkle_preview_v1_'||kind||'.webp';
    edge:=CASE kind WHEN 'thumb' THEN 360 WHEN 'display' THEN 1280 ELSE 1920 END;
    IF variant IS NULL OR variant->>'path' IS DISTINCT FROM expected
      OR variant->>'width' IS NULL OR variant->>'height' IS NULL
      OR (variant->>'width')::integer NOT BETWEEN 1 AND edge OR (variant->>'height')::integer NOT BETWEEN 1 AND edge THEN
      RAISE EXCEPTION 'Invalid image preview' USING ERRCODE='22023'; END IF;
    SELECT * INTO object_row FROM storage.objects WHERE bucket_id=asset.bucket_id AND name=expected;
    IF object_row.id IS NULL OR object_row.metadata->>'mimetype' IS DISTINCT FROM 'image/webp'
      OR COALESCE((object_row.metadata->>'size')::bigint,0)<=0
      OR (auth.role()<>'service_role' AND object_row.owner_id IS DISTINCT FROM auth.uid()::text) THEN
      RAISE EXCEPTION 'Image preview upload not confirmed' USING ERRCODE='22023'; END IF;
    checked:=checked||jsonb_build_object(kind,jsonb_build_object('path',expected,'width',(variant->>'width')::integer,'height',(variant->>'height')::integer,'bytes',(object_row.metadata->>'size')::bigint));
  END LOOP;
  UPDATE public.media_image_assets SET status='ready',width=p_width,height=p_height,variants=checked,animated=p_animated,
    last_error=NULL,processing_token=NULL,lease_until=NULL,updated_at=now() WHERE id=p_id RETURNING * INTO asset;
  RETURN to_jsonb(asset);
END; $$;

CREATE OR REPLACE FUNCTION public.fail_image_asset(p_id uuid,p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.media_image_assets SET status='failed',last_error='Preview processing did not finish',lease_until=NULL,
    processing_token=NULL,next_attempt_at=now()+interval '1 minute',updated_at=now()
    WHERE id=p_id AND processing_token=p_token AND status='processing'
      AND (owner_id=auth.uid() OR auth.role()='service_role');
END; $$;

-- Service-only leases allow a resumable processor to finish failed/interrupted
-- uploads and backfill legacy images without opening private storage to users.
CREATE OR REPLACE FUNCTION public.claim_image_asset(p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE asset public.media_image_assets%ROWTYPE;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Worker authorization required' USING ERRCODE='42501'; END IF;
  SELECT * INTO asset FROM public.media_image_assets WHERE status<>'ready' AND (attempts<5 OR (p_id IS NOT NULL AND next_attempt_at<=now())) AND (p_id IS NULL OR id=p_id) AND (p_id IS NOT NULL OR next_attempt_at<=now())
    AND (status<>'processing' OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF asset.id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.media_image_assets SET status='processing',processing_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',
    attempts=CASE WHEN attempts>=5 THEN 1 ELSE attempts+1 END,updated_at=now() WHERE id=asset.id RETURNING * INTO asset;
  RETURN to_jsonb(asset);
END; $$;

CREATE OR REPLACE FUNCTION public.enqueue_legacy_image_previews(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE added integer;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Worker authorization required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.media_image_assets(owner_id,bucket_id,original_path,original_name,original_mime,original_bytes,is_published)
    SELECT p.id,o.bucket_id,o.name,regexp_replace(o.name,'^.*/',''),o.metadata->>'mimetype',(o.metadata->>'size')::bigint,regexp_replace(o.name,'^.*/','') NOT LIKE 'serkle_image_v1_%'
    FROM storage.objects o JOIN public.profiles p ON p.id::text=COALESCE(NULLIF(o.owner_id,''),to_jsonb(o)->>'owner',CASE WHEN o.bucket_id='chat-media' THEN split_part(o.name,'/',2) ELSE left(o.name,36) END)
    WHERE o.bucket_id IN ('post-media','chat-media') AND o.name NOT LIKE '%.__serkle_preview_%'
      AND o.metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif','image/gif','image/bmp','image/tiff')
      AND (o.metadata->>'size')::bigint BETWEEN 1 AND 52428800
      AND NOT EXISTS(SELECT 1 FROM public.media_image_assets a WHERE a.bucket_id=o.bucket_id AND a.original_path=o.name)
    ORDER BY o.created_at LIMIT greatest(1,least(p_limit,500)) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS added=ROW_COUNT; RETURN added;
END; $$;

-- Resolve every registered derivative to its original before evaluating Circle
-- entitlements. No change to purchases, memberships, or original object names.
CREATE OR REPLACE FUNCTION public.can_read_circle_storage(_bucket text,_name text,_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE canonical text;
BEGIN
  IF _name LIKE '%.__serkle_preview_v1_%' THEN
    SELECT original_path INTO canonical FROM public.media_image_assets WHERE bucket_id=_bucket
      AND _name IN (original_path||'.__serkle_preview_v1_thumb.webp',original_path||'.__serkle_preview_v1_display.webp',original_path||'.__serkle_preview_v1_full.webp');
    IF canonical IS NULL THEN RETURN false; END IF;
    _name:=canonical;
  END IF;
  IF _bucket='circle-videos' THEN
    RETURN EXISTS(SELECT 1 FROM circle_videos v WHERE
      (circle_storage_path(v.video_url,_bucket)=_name AND circle_content_access('video',v.id,_user))
      OR (circle_storage_path(v.thumbnail_url,_bucket)=_name AND can_browse_circle(v.circle_id,_user)));
  ELSIF _bucket='circle-resources' THEN
    RETURN EXISTS(SELECT 1 FROM circle_resources r WHERE circle_storage_path(r.file_url,_bucket)=_name AND circle_content_access('resource',r.id,_user));
  ELSIF _bucket='post-media' THEN
    RETURN NOT EXISTS(SELECT 1 FROM posts p WHERE p.circle_id IS NOT NULL AND p.is_premium
      AND EXISTS(SELECT 1 FROM unnest(COALESCE(p.media_urls,'{}'::text[])||ARRAY[p.media_url,p.cover_image_url,p.voice_url,p.original_pdf_url]) u WHERE circle_storage_path(u,_bucket)=_name)
      AND NOT circle_content_access('post',p.id,_user));
  END IF;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.image_preview_write_allowed(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.media_image_assets a WHERE a.owner_id=auth.uid() AND a.bucket_id=p_bucket
    AND p_path IN (a.original_path||'.__serkle_preview_v1_thumb.webp',a.original_path||'.__serkle_preview_v1_display.webp',a.original_path||'.__serkle_preview_v1_full.webp')
    AND a.status='processing' AND a.lease_until>now() AND public.can_read_image_asset(a.bucket_id,a.original_path))
$$;
CREATE OR REPLACE FUNCTION public.image_preview_read_allowed(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.media_image_assets a WHERE a.bucket_id=p_bucket
    AND p_path IN (a.original_path||'.__serkle_preview_v1_thumb.webp',a.original_path||'.__serkle_preview_v1_display.webp',a.original_path||'.__serkle_preview_v1_full.webp')
    AND public.can_read_image_asset(a.bucket_id,a.original_path))
$$;
CREATE OR REPLACE FUNCTION public.is_registered_image_original(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.media_image_assets WHERE bucket_id=p_bucket AND original_path=p_path)
$$;
CREATE OR REPLACE FUNCTION public.image_original_read_allowed(p_bucket text,p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_path LIKE '%.__serkle_preview_%' THEN RETURN true; END IF; -- Separate preview guard below.
  IF public.is_registered_image_original(p_bucket,p_path) THEN RETURN public.can_read_image_asset(p_bucket,p_path); END IF;
  IF regexp_replace(p_path,'^.*/','') LIKE 'serkle_image_v1_%' THEN
    RETURN EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=p_bucket AND name=p_path AND owner_id=auth.uid()::text)
      AND (p_bucket='post-media' OR (p_bucket='chat-media' AND public.can_access_chat_object(p_path,true)));
  END IF;
  RETURN true;
END; $$;
-- Do not expose a new premium upload in the gap before its post is committed.
-- Publication/revocation is atomic with the parent post, never a client flag.
CREATE OR REPLACE FUNCTION public.sync_post_image_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE links text[]:='{}';
BEGIN
  IF TG_OP<>'DELETE' THEN links:=links||COALESCE(NEW.media_urls,'{}')||ARRAY[NEW.media_url,NEW.cover_image_url]; END IF;
  IF TG_OP<>'INSERT' THEN links:=links||COALESCE(OLD.media_urls,'{}')||ARRAY[OLD.media_url,OLD.cover_image_url]; END IF;
  UPDATE public.media_image_assets a SET is_published=EXISTS(
    SELECT 1 FROM public.posts p WHERE (p.user_id=a.owner_id OR a.owner_id=auth.uid() OR a.is_published OR auth.role()='service_role')
      AND EXISTS(SELECT 1 FROM unnest(COALESCE(p.media_urls,'{}')||ARRAY[p.media_url,p.cover_image_url]) u
        WHERE public.circle_storage_path(u,'post-media')=a.original_path))
    WHERE a.bucket_id='post-media' AND a.original_path=ANY(ARRAY(SELECT public.circle_storage_path(u,'post-media') FROM unnest(links) u WHERE u IS NOT NULL));
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS post_image_publication ON public.posts;
CREATE TRIGGER post_image_publication AFTER INSERT OR UPDATE OF media_url,media_urls,cover_image_url OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_image_publication();
REVOKE ALL ON FUNCTION public.sync_post_image_publication() FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS image_original_read_guard ON storage.objects;
CREATE POLICY image_original_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(
  public.image_original_read_allowed(bucket_id,name));
DROP POLICY IF EXISTS image_preview_read_guard ON storage.objects;
CREATE POLICY image_preview_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(
  name NOT LIKE '%.__serkle_preview_%' OR public.image_preview_read_allowed(bucket_id,name));
DROP POLICY IF EXISTS image_preview_insert_guard ON storage.objects;
CREATE POLICY image_preview_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
  name NOT LIKE '%.__serkle_preview_%' OR public.image_preview_write_allowed(bucket_id,name));
DROP POLICY IF EXISTS image_preview_update_guard ON storage.objects;
CREATE POLICY image_preview_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING(name NOT LIKE '%.__serkle_preview_%' AND NOT public.is_registered_image_original(bucket_id,name))
  WITH CHECK(name NOT LIKE '%.__serkle_preview_%' AND NOT public.is_registered_image_original(bucket_id,name));

DO $$ DECLARE fn regprocedure; BEGIN
  FOREACH fn IN ARRAY ARRAY['public.can_read_image_asset(text,text)'::regprocedure,'public.prepare_image_asset(text,text,text,text,text,uuid)'::regprocedure,
    'public.complete_image_asset(uuid,uuid,integer,integer,jsonb,boolean)'::regprocedure,'public.fail_image_asset(uuid,uuid)'::regprocedure,'public.image_preview_write_allowed(text,text)'::regprocedure,
    'public.image_preview_read_allowed(text,text)'::regprocedure,'public.is_registered_image_original(text,text)'::regprocedure,'public.image_original_read_allowed(text,text)'::regprocedure] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',fn);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.claim_image_asset(uuid),public.enqueue_legacy_image_previews(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_image_asset(uuid),public.enqueue_legacy_image_previews(integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
