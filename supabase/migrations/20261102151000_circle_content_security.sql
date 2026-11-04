-- Restrictive policies protect direct table access even if a historical
-- permissive SELECT policy remains present on the installation.
CREATE POLICY circle_post_entitlement_guard ON public.posts AS RESTRICTIVE FOR SELECT
  USING (circle_id IS NULL OR public.circle_content_access('post', id, auth.uid()));
CREATE POLICY circle_video_entitlement_guard ON public.circle_videos AS RESTRICTIVE FOR SELECT
  USING (public.circle_content_access('video', id, auth.uid()));
CREATE POLICY circle_resource_entitlement_guard ON public.circle_resources AS RESTRICTIVE FOR SELECT
  USING (public.circle_content_access('resource', id, auth.uid()));

CREATE OR REPLACE FUNCTION public.get_circle_subscription(_circle_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT to_jsonb(s) FROM circle_subscriptions s
    WHERE circle_id = _circle_id AND user_id = auth.uid()
      AND public.has_circle_subscription(_circle_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_circle_videos(_circle_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(v) || jsonb_build_object(
    'video_url', CASE WHEN public.circle_content_access('video', v.id, auth.uid()) THEN v.video_url END,
    'user_has_unlocked', public.circle_content_access('video', v.id, auth.uid()),
    'author', jsonb_build_object('name', p.name, 'username', p.username, 'avatar_url', p.avatar_url, 'avatar_color', p.avatar_color, 'initials', p.initials)
  ) ORDER BY v.created_at DESC), '[]'::jsonb)
  FROM circle_videos v JOIN profiles p ON p.id = v.user_id
  WHERE v.circle_id = _circle_id AND (public.can_browse_circle(_circle_id, auth.uid()) OR public.circle_content_access('video', v.id, auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.get_circle_resources(_circle_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(r) || jsonb_build_object(
    'file_url', CASE WHEN public.circle_content_access('resource', r.id, auth.uid()) THEN r.file_url END,
    'can_access', public.circle_content_access('resource', r.id, auth.uid()),
    'profiles', jsonb_build_object('name', p.name, 'avatar_url', p.avatar_url)
  ) ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM circle_resources r JOIN profiles p ON p.id = r.uploader_id
  WHERE r.circle_id = _circle_id AND public.can_browse_circle(_circle_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.circle_storage_path(_url text, _bucket text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _url LIKE '%/storage/v1/object/%/' || _bucket || '/%'
    THEN split_part(split_part(_url, '/' || _bucket || '/', 2), '?', 1)
    ELSE _url END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_circle_storage(_bucket text, _name text, _user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF _bucket = 'circle-videos' THEN
    RETURN EXISTS (SELECT 1 FROM circle_videos v WHERE
      (circle_storage_path(v.video_url, _bucket) = _name AND circle_content_access('video', v.id, _user))
      OR (circle_storage_path(v.thumbnail_url, _bucket) = _name AND can_browse_circle(v.circle_id, _user)));
  ELSIF _bucket = 'circle-resources' THEN
    RETURN EXISTS (SELECT 1 FROM circle_resources r WHERE circle_storage_path(r.file_url, _bucket) = _name AND circle_content_access('resource', r.id, _user));
  ELSIF _bucket = 'post-media' THEN
    -- This shared bucket also contains personal posts and question attachments.
    -- Only objects referenced by premium Circle posts require this entitlement.
    RETURN NOT EXISTS (SELECT 1 FROM posts p WHERE p.circle_id IS NOT NULL AND p.is_premium
      AND EXISTS (SELECT 1 FROM unnest(COALESCE(p.media_urls, '{}'::text[]) || ARRAY[p.media_url, p.cover_image_url, p.voice_url, p.original_pdf_url]) u
        WHERE circle_storage_path(u, _bucket) = _name)
      AND NOT circle_content_access('post', p.id, _user));
  END IF;
  RETURN true;
END;
$$;

-- Public bucket URLs bypass object RLS completely. Making these buckets private
-- closes that bypass for legacy files too; frontend readers now sign media.
UPDATE storage.buckets SET public = false WHERE id IN ('circle-videos', 'circle-resources', 'post-media');
CREATE POLICY circle_media_entitlement_guard ON storage.objects AS RESTRICTIVE FOR SELECT
  USING (public.can_read_circle_storage(bucket_id, name, auth.uid()));

-- List/preview RPCs expose metadata only; file/text payloads are redacted below.
GRANT EXECUTE ON FUNCTION public.get_circle_subscription(uuid), public.get_circle_videos(uuid), public.get_circle_resources(uuid) TO authenticated;

-- Generic wallet RPCs must not accept a different payer or negative amounts.
ALTER FUNCTION public.transfer_coins(uuid,uuid,integer,public.coin_transaction_type,public.coin_transaction_type,uuid,text) RENAME TO transfer_coins_internal;
ALTER FUNCTION public.spend_coins(uuid,integer,public.coin_transaction_type,uuid,text) RENAME TO spend_coins_internal;
REVOKE ALL ON FUNCTION public.transfer_coins_internal(uuid,uuid,integer,public.coin_transaction_type,public.coin_transaction_type,uuid,text), public.spend_coins_internal(uuid,integer,public.coin_transaction_type,uuid,text) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.transfer_coins(_sender_id uuid, _receiver_id uuid, _amount integer, _type_sent coin_transaction_type, _type_received coin_transaction_type, _reference_id uuid DEFAULT NULL, _description text DEFAULT '')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _sender_id OR _amount <= 0 OR _amount IS NULL OR _sender_id = _receiver_id THEN RAISE EXCEPTION 'Invalid payment'; END IF;
  RETURN transfer_coins_internal(_sender_id, _receiver_id, _amount, _type_sent, _type_received, _reference_id, _description);
END;
$$;
CREATE FUNCTION public.spend_coins(_user_id uuid, _amount integer, _type coin_transaction_type, _reference_id uuid DEFAULT NULL, _description text DEFAULT '')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id OR _amount <= 0 OR _amount IS NULL THEN RAISE EXCEPTION 'Invalid payment'; END IF;
  RETURN spend_coins_internal(_user_id, _amount, _type, _reference_id, _description);
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_coins(uuid,uuid,integer,public.coin_transaction_type,public.coin_transaction_type,uuid,text), public.spend_coins(uuid,integer,public.coin_transaction_type,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_coins(uuid,uuid,integer,public.coin_transaction_type,public.coin_transaction_type,uuid,text), public.spend_coins(uuid,integer,public.coin_transaction_type,uuid,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
