-- Phase 1B. Review and run in staging first. Does NOT migrate/delete legacy files.
BEGIN;

-- Separate immutable arrival order from the delta-sync cursor (edits advance seq).
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_seq bigint;
UPDATE public.messages SET created_seq = seq WHERE created_seq IS NULL;
CREATE OR REPLACE FUNCTION public.set_message_seq()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE next_seq bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.conversations SET current_seq = COALESCE(current_seq, 0) + 1
      WHERE id = NEW.conversation_id RETURNING current_seq INTO next_seq;
    NEW.seq := next_seq;
    NEW.created_seq := next_seq;
  ELSE
    IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id OR NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
      RAISE EXCEPTION 'Message identity cannot change';
    END IF;
    NEW.created_seq := OLD.created_seq;
    NEW.seq := OLD.seq;
    IF ROW(OLD.content, OLD.attachment_url, OLD.deleted_for_everyone, OLD.is_edited)
      IS DISTINCT FROM ROW(NEW.content, NEW.attachment_url, NEW.deleted_for_everyone, NEW.is_edited) THEN
      UPDATE public.conversations SET current_seq = COALESCE(current_seq, 0) + 1
        WHERE id = NEW.conversation_id RETURNING current_seq INTO next_seq;
      NEW.seq := next_seq;
      NEW.updated_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE INDEX IF NOT EXISTS messages_chat_arrival_idx ON public.messages (conversation_id, created_seq);

CREATE OR REPLACE FUNCTION public.chat_member(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = p_conversation_id AND cm.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.chat_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_member(uuid) TO authenticated;

ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own read receipts" ON public.read_receipts;
DROP POLICY IF EXISTS "Users can insert/update their own read receipts" ON public.read_receipts;
CREATE POLICY chat_receipts_read ON public.read_receipts FOR SELECT TO authenticated
  USING (public.chat_member(conversation_id));
CREATE POLICY chat_receipts_insert ON public.read_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.chat_member(conversation_id));
CREATE POLICY chat_receipts_update ON public.read_receipts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.chat_member(conversation_id))
  WITH CHECK (user_id = auth.uid() AND public.chat_member(conversation_id));
-- Restrictive guards also constrain any pre-existing permissive policies.
CREATE POLICY chat_receipts_read_guard ON public.read_receipts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.chat_member(conversation_id));
CREATE POLICY chat_receipts_insert_guard ON public.read_receipts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.chat_member(conversation_id));
CREATE POLICY chat_receipts_update_guard ON public.read_receipts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.chat_member(conversation_id))
  WITH CHECK (user_id = auth.uid() AND public.chat_member(conversation_id));
CREATE POLICY chat_receipts_no_delete ON public.read_receipts AS RESTRICTIVE FOR DELETE TO authenticated USING (false);
REVOKE ALL ON public.read_receipts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.read_receipts TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_chat_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ceiling bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id) THEN
    RAISE EXCEPTION 'Receipt identity cannot change';
  END IF;
  SELECT COALESCE(current_seq, 0) INTO ceiling FROM public.conversations WHERE id = NEW.conversation_id;
  NEW.last_read_seq := LEAST(GREATEST(COALESCE(NEW.last_read_seq, 0), 0), COALESCE(ceiling, 0));
  IF TG_OP = 'UPDATE' THEN NEW.last_read_seq := GREATEST(OLD.last_read_seq, NEW.last_read_seq); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER chat_receipt_monotonic BEFORE INSERT OR UPDATE ON public.read_receipts
  FOR EACH ROW EXECUTE FUNCTION public.guard_chat_receipt();

CREATE OR REPLACE FUNCTION public.get_chat_unread_counts(p_local_reads jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(conversation_id uuid, unread_count bigint, last_read_seq bigint, latest_seq bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.id, (
    SELECT count(*) FROM public.messages m
    WHERE m.conversation_id = c.id AND m.sender_id <> auth.uid()
      AND COALESCE(m.created_seq, m.seq, 0) > pos.read_seq
      AND NOT COALESCE(m.deleted_for_everyone, false)
      AND NOT EXISTS (SELECT 1 FROM public.message_deletions d WHERE d.message_id = m.id AND d.user_id = auth.uid())
  ), pos.read_seq, COALESCE(c.current_seq, 0)
  FROM public.conversations c
  JOIN public.conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = auth.uid()
  LEFT JOIN public.read_receipts r ON r.conversation_id = c.id AND r.user_id = auth.uid()
  CROSS JOIN LATERAL (
    SELECT GREATEST(COALESCE(r.last_read_seq, 0), LEAST(COALESCE(c.current_seq, 0),
      GREATEST(COALESCE((p_local_reads ->> c.id::text)::bigint, 0), 0))) AS read_seq
  ) pos;
$$;
REVOKE ALL ON FUNCTION public.get_chat_unread_counts(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_unread_counts(jsonb) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-media', 'chat-media', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

-- Paths: conversation UUID / uploader UUID / unique safe filename.
CREATE OR REPLACE FUNCTION public.can_access_chat_object(p_name text, p_upload boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE parts text[] := string_to_array(p_name, '/'); cid uuid; uploader uuid;
BEGIN
  IF array_length(parts, 1) <> 3 OR parts[3] !~ '^[a-zA-Z0-9_.-]+$' OR parts[3] IN ('.', '..') THEN RETURN false; END IF;
  BEGIN cid := parts[1]::uuid; uploader := parts[2]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
  RETURN public.chat_member(cid) AND (NOT p_upload OR uploader = auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.can_access_chat_object(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_chat_object(text, boolean) TO authenticated;
CREATE POLICY chat_media_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media' AND public.can_access_chat_object(name));
CREATE POLICY chat_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND public.can_access_chat_object(name, true));
CREATE POLICY chat_media_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'chat-media' OR public.can_access_chat_object(name));
CREATE POLICY chat_media_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'chat-media' OR public.can_access_chat_object(name, true));
CREATE POLICY chat_media_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'chat-media') WITH CHECK (bucket_id <> 'chat-media');
CREATE POLICY chat_media_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (bucket_id <> 'chat-media');
CREATE POLICY chat_media_no_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon
  USING (bucket_id <> 'chat-media') WITH CHECK (bucket_id <> 'chat-media');

CREATE OR REPLACE FUNCTION public.guard_chat_attachment_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE path text;
BEGIN
  IF NEW.attachment_url LIKE 'chat-media://%' THEN
    path := substr(NEW.attachment_url, 14);
    IF split_part(path, '/', 1) <> NEW.conversation_id::text
      OR (auth.role() IS DISTINCT FROM 'service_role' AND NOT public.can_access_chat_object(path)) THEN
      RAISE EXCEPTION 'Attachment must belong to this conversation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER chat_attachment_scope BEFORE INSERT OR UPDATE OF attachment_url, conversation_id ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_chat_attachment_reference();
COMMIT;
