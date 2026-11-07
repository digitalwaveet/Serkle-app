-- Apply after 20261106190000_messaging_groups_and_polls.sql.
-- Keep existing conversations, members, message IDs, files and timestamps.
BEGIN;
-- Recreate API endpoints whose return type or OUT columns vary in legacy projects.
-- This changes function definitions only; dependent data and policy helpers are retained.
DROP FUNCTION IF EXISTS public.get_or_create_conversation(uuid,uuid);
DROP FUNCTION IF EXISTS public.sync_messages(uuid,bigint);
DROP FUNCTION IF EXISTS public.get_user_conversations(uuid);
CREATE OR REPLACE FUNCTION public.chat_member(p_conversation_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.chat_member(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.chat_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_message_access(p_message_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.messages m WHERE m.id=p_message_id AND public.chat_member(m.conversation_id));
$$;
REVOKE ALL ON FUNCTION public.chat_message_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.chat_message_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_user1_id uuid,_user2_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() NOT IN (_user1_id,_user2_id) OR _user1_id IS NULL OR _user2_id IS NULL THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';END IF;
  IF _user1_id=_user2_id THEN RAISE EXCEPTION 'Choose another person to message' USING ERRCODE='22023';END IF;
  IF (SELECT count(*) FROM public.profiles WHERE id IN (_user1_id,_user2_id))<>2 THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='22023';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(LEAST(_user1_id::text,_user2_id::text)||'/'||GREATEST(_user1_id::text,_user2_id::text),0));
  SELECT c.id INTO result FROM public.conversations c
    WHERE NOT c.is_group AND EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=c.id AND user_id=_user1_id)
      AND EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=c.id AND user_id=_user2_id)
      AND (SELECT count(*) FROM public.conversation_members WHERE conversation_id=c.id)=2
    ORDER BY c.created_at,c.id LIMIT 1;
  IF result IS NULL THEN
    INSERT INTO public.conversations(is_group,created_by) VALUES(false,auth.uid()) RETURNING id INTO result;
    INSERT INTO public.conversation_members(conversation_id,user_id) VALUES(result,_user1_id),(result,_user2_id);
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid,uuid) TO authenticated;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_message_read_guard ON public.messages;
CREATE POLICY chat_message_read_guard ON public.messages AS RESTRICTIVE FOR SELECT TO authenticated USING(public.chat_member(conversation_id));
DROP POLICY IF EXISTS chat_message_insert_guard ON public.messages;
CREATE POLICY chat_message_insert_guard ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(sender_id=auth.uid() AND public.chat_member(conversation_id));
DROP POLICY IF EXISTS chat_message_update_guard ON public.messages;
CREATE POLICY chat_message_update_guard ON public.messages AS RESTRICTIVE FOR UPDATE TO authenticated USING(sender_id=auth.uid() AND public.chat_member(conversation_id)) WITH CHECK(sender_id=auth.uid() AND public.chat_member(conversation_id));
DROP POLICY IF EXISTS chat_message_delete_guard ON public.messages;
CREATE POLICY chat_message_delete_guard ON public.messages AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
DROP POLICY IF EXISTS chat_message_no_anon ON public.messages;
CREATE POLICY chat_message_no_anon ON public.messages AS RESTRICTIVE FOR ALL TO anon USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.guard_chat_message_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.id,NEW.sender_id,NEW.conversation_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.sender_id,OLD.conversation_id,OLD.created_at) THEN RAISE EXCEPTION 'Message identity cannot change' USING ERRCODE='42501';END IF;
  IF NEW.reply_to_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.messages m WHERE m.id=NEW.reply_to_id AND m.conversation_id=NEW.conversation_id AND NOT COALESCE(m.deleted_for_everyone,false)) THEN RAISE EXCEPTION 'Reply must belong to this conversation' USING ERRCODE='22023';END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_chat_message_identity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS chat_message_identity ON public.messages;
CREATE TRIGGER chat_message_identity BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_chat_message_identity();

DROP POLICY IF EXISTS chat_conversation_member_read_guard ON public.conversation_members;
CREATE POLICY chat_conversation_member_read_guard ON public.conversation_members AS RESTRICTIVE FOR SELECT TO authenticated USING(public.chat_member(conversation_id));
DROP POLICY IF EXISTS chat_conversation_member_insert_guard ON public.conversation_members;
CREATE POLICY chat_conversation_member_insert_guard ON public.conversation_members AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
DROP POLICY IF EXISTS chat_conversation_insert_guard ON public.conversations;
CREATE POLICY chat_conversation_insert_guard ON public.conversations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
DROP POLICY IF EXISTS chat_conversation_read_guard ON public.conversations;
CREATE POLICY chat_conversation_read_guard ON public.conversations AS RESTRICTIVE FOR SELECT TO authenticated USING(public.chat_member(id));
DROP POLICY IF EXISTS chat_conversation_update_guard ON public.conversations;
CREATE POLICY chat_conversation_update_guard ON public.conversations AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.chat_member(id)) WITH CHECK(public.chat_member(id));
DROP POLICY IF EXISTS chat_member_delete_guard ON public.conversation_members;
CREATE POLICY chat_member_delete_guard ON public.conversation_members AS RESTRICTIVE FOR DELETE TO authenticated USING(public.chat_member(conversation_id) AND (public.chat_is_group(conversation_id) OR user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_chat_conversation_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE table_owner text;
BEGIN
  SELECT pg_get_userbyid(relowner) INTO table_owner FROM pg_class WHERE oid=TG_RELID;
  IF current_user=table_owner THEN RETURN NEW;END IF;
  IF ROW(NEW.id,NEW.is_group,NEW.created_by,NEW.current_seq) IS DISTINCT FROM ROW(OLD.id,OLD.is_group,OLD.created_by,OLD.current_seq) THEN RAISE EXCEPTION 'Protected conversation fields cannot change' USING ERRCODE='42501';END IF;
  IF NEW.pinned_message_id IS DISTINCT FROM OLD.pinned_message_id AND NEW.pinned_message_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.messages m WHERE m.id=NEW.pinned_message_id AND m.conversation_id=OLD.id AND NOT COALESCE(m.deleted_for_everyone,false)) THEN RAISE EXCEPTION 'Pinned message unavailable' USING ERRCODE='22023';END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_chat_conversation_identity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS chat_conversation_identity ON public.conversations;
CREATE TRIGGER chat_conversation_identity BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.guard_chat_conversation_identity();
CREATE OR REPLACE FUNCTION public.guard_chat_membership_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF ROW(NEW.id,NEW.conversation_id,NEW.user_id) IS DISTINCT FROM ROW(OLD.id,OLD.conversation_id,OLD.user_id) THEN RAISE EXCEPTION 'Membership identity cannot change' USING ERRCODE='42501';END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_chat_membership_identity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS chat_membership_identity ON public.conversation_members;
CREATE TRIGGER chat_membership_identity BEFORE UPDATE ON public.conversation_members FOR EACH ROW EXECUTE FUNCTION public.guard_chat_membership_identity();

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_deletion_read ON public.message_deletions;
CREATE POLICY chat_deletion_read ON public.message_deletions FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS chat_deletion_read_guard ON public.message_deletions;
CREATE POLICY chat_deletion_read_guard ON public.message_deletions AS RESTRICTIVE FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS chat_deletion_insert_guard ON public.message_deletions;
CREATE POLICY chat_deletion_insert_guard ON public.message_deletions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.chat_message_access(message_id));
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_reaction_read_guard ON public.message_reactions;
CREATE POLICY chat_reaction_read_guard ON public.message_reactions AS RESTRICTIVE FOR SELECT TO authenticated USING(public.chat_message_access(message_id));
DROP POLICY IF EXISTS chat_reaction_insert_guard ON public.message_reactions;
CREATE POLICY chat_reaction_insert_guard ON public.message_reactions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.chat_message_access(message_id));
DROP POLICY IF EXISTS chat_reaction_delete_guard ON public.message_reactions;
CREATE POLICY chat_reaction_delete_guard ON public.message_reactions AS RESTRICTIVE FOR DELETE TO authenticated USING(user_id=auth.uid() AND public.chat_message_access(message_id));

CREATE OR REPLACE FUNCTION public.sync_messages(p_conversation_id uuid,p_after_seq bigint) RETURNS SETOF public.messages
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT m.* FROM public.messages m WHERE m.conversation_id=p_conversation_id AND public.chat_member(p_conversation_id) AND m.seq>GREATEST(COALESCE(p_after_seq,0),0)
    AND NOT EXISTS(SELECT 1 FROM public.message_deletions d WHERE d.message_id=m.id AND d.user_id=auth.uid()) ORDER BY m.seq,m.id;
$$;
REVOKE ALL ON FUNCTION public.sync_messages(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_messages(uuid,bigint) TO authenticated;
-- Conversation previews obey the same deletion rules as the message reader.
-- Update get_user_conversations to use the new read_receipts table and seq for accurate unread counts
CREATE OR REPLACE FUNCTION public.get_user_conversations(_user_id uuid)
 RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_user_name text, other_user_username text, other_user_avatar text, other_user_initials text, other_user_online boolean, last_message text, last_message_at timestamp with time zone, last_message_sender_id uuid, unread_count bigint, is_group boolean, group_name text, group_avatar_url text, member_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT * FROM (
    -- 1-on-1 conversations
    SELECT DISTINCT ON (c.id)
      c.id as conversation_id,
      p.id as other_user_id,
      p.name as other_user_name,
      p.username as other_user_username,
      p.avatar_url as other_user_avatar,
      p.initials as other_user_initials,
      p.is_online as other_user_online,
      m.content as last_message,
      m.created_at as last_message_at,
      m.sender_id as last_message_sender_id,
      (
        SELECT COUNT(*)
        FROM messages msg
        WHERE msg.conversation_id = c.id
          AND msg.sender_id != _user_id
          AND NOT COALESCE(msg.deleted_for_everyone, false)
          AND NOT EXISTS (SELECT 1 FROM public.message_deletions d WHERE d.message_id = msg.id AND d.user_id = _user_id)
          AND COALESCE(msg.created_seq, msg.seq, 0) > COALESCE((
            SELECT r.last_read_seq
            FROM read_receipts r
            WHERE r.conversation_id = c.id AND r.user_id = _user_id
          ), 0)
      ) as unread_count,
      false as is_group,
      NULL::text as group_name,
      NULL::text as group_avatar_url,
      2::bigint as member_count
    FROM conversations c
    INNER JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = _user_id
    INNER JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id != _user_id
    INNER JOIN profiles p ON cm2.user_id = p.id
    LEFT JOIN LATERAL (
      SELECT msg2.content, msg2.created_at, msg2.sender_id
      FROM messages msg2
      WHERE msg2.conversation_id = c.id
        AND NOT COALESCE(msg2.deleted_for_everyone,false)
        AND NOT EXISTS(SELECT 1 FROM public.message_deletions d WHERE d.message_id=msg2.id AND d.user_id=_user_id)
      ORDER BY msg2.created_at DESC
      LIMIT 1
    ) m ON true
    WHERE c.is_group = false
    ORDER BY c.id, m.created_at DESC NULLS LAST
  ) dm

  UNION ALL

  SELECT * FROM (
    SELECT
      c.id as conversation_id,
      NULL::uuid as other_user_id,
      c.group_name as other_user_name,
      NULL::text as other_user_username,
      c.group_avatar_url as other_user_avatar,
      UPPER(LEFT(c.group_name, 2)) as other_user_initials,
      false as other_user_online,
      m.content as last_message,
      m.created_at as last_message_at,
      m.sender_id as last_message_sender_id,
      (
        SELECT COUNT(*)
        FROM messages msg
        WHERE msg.conversation_id = c.id
          AND msg.sender_id != _user_id
          AND NOT COALESCE(msg.deleted_for_everyone, false)
          AND NOT EXISTS (SELECT 1 FROM public.message_deletions d WHERE d.message_id = msg.id AND d.user_id = _user_id)
          AND COALESCE(msg.created_seq, msg.seq, 0) > COALESCE((
            SELECT r.last_read_seq
            FROM read_receipts r
            WHERE r.conversation_id = c.id AND r.user_id = _user_id
          ), 0)
      ) as unread_count,
      true as is_group,
      c.group_name,
      c.group_avatar_url,
      (SELECT COUNT(*) FROM conversation_members cm3 WHERE cm3.conversation_id = c.id) as member_count
    FROM conversations c
    INNER JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = _user_id
    LEFT JOIN LATERAL (
      SELECT msg2.content, msg2.created_at, msg2.sender_id
      FROM messages msg2
      WHERE msg2.conversation_id = c.id
        AND NOT COALESCE(msg2.deleted_for_everyone,false)
        AND NOT EXISTS(SELECT 1 FROM public.message_deletions d WHERE d.message_id=msg2.id AND d.user_id=_user_id)
      ORDER BY msg2.created_at DESC
      LIMIT 1
    ) m ON true
    WHERE c.is_group = true
  ) grp

  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_conversations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_conversations(uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
