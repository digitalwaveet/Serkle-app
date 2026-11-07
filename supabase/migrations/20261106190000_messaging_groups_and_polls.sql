-- Messaging Option B: authenticated group actions, private invites and poll totals.
-- Deploy with the matching frontend. No ownership/membership history is deleted.
BEGIN;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS pinned_message_id uuid;

CREATE TABLE IF NOT EXISTS public.group_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, UNIQUE(conversation_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.group_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, muted_until timestamptz, UNIQUE(conversation_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.group_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id),question text NOT NULL,options jsonb NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,is_multiple_choice boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',ended_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_polls ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.group_polls ADD COLUMN IF NOT EXISTS ended_at timestamptz;
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),poll_id uuid NOT NULL REFERENCES public.group_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),option_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(poll_id,user_id,option_id)
);
CREATE TABLE IF NOT EXISTS public.chat_group_requests (
  user_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,operation text NOT NULL,result_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,request_id)
);
CREATE TABLE IF NOT EXISTS public.chat_group_invites (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_group_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_group_requests FROM PUBLIC,anon,authenticated;

-- Legacy deployments may return boolean, text, JSON or TABLE from these RPCs.
-- PostgreSQL cannot replace their return contract; recreate only the named endpoints.
-- RESTRICT is intentional: no CASCADE, tables, messages or membership data are removed.
DROP FUNCTION IF EXISTS public.create_group_conversation(uuid,text,uuid[]);
DROP FUNCTION IF EXISTS public.create_group_conversation(uuid,text,uuid[],uuid);
DROP FUNCTION IF EXISTS public.add_chat_group_members(uuid,uuid[]);
DROP FUNCTION IF EXISTS public.set_chat_group_admin(uuid,uuid,boolean);
DROP FUNCTION IF EXISTS public.remove_group_member(uuid,uuid);
DROP FUNCTION IF EXISTS public.transfer_chat_group_ownership(uuid,uuid);
DROP FUNCTION IF EXISTS public.update_chat_group(uuid,text,text,text);
DROP FUNCTION IF EXISTS public.create_chat_group_invite(uuid);
DROP FUNCTION IF EXISTS public.get_chat_group_invite(uuid);
DROP FUNCTION IF EXISTS public.join_chat_group(uuid);
DROP FUNCTION IF EXISTS public.revoke_chat_group_invite(uuid);
DROP FUNCTION IF EXISTS public.create_chat_group_poll(uuid,text,text[],boolean,boolean,uuid);
DROP FUNCTION IF EXISTS public.set_chat_poll_vote(uuid,text,boolean);
DROP FUNCTION IF EXISTS public.end_chat_group_poll(uuid);
DROP FUNCTION IF EXISTS public.get_chat_group_poll(uuid);
DROP FUNCTION IF EXISTS public.get_chat_group_polls(uuid);
DROP FUNCTION IF EXISTS public.get_chat_poll_voters(uuid);

CREATE OR REPLACE FUNCTION public.chat_is_group(p_conversation_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT COALESCE((SELECT is_group FROM public.conversations WHERE id=p_conversation_id),false);
$$;
CREATE OR REPLACE FUNCTION public.chat_group_member(p_conversation_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.conversations c JOIN public.conversation_members m ON m.conversation_id=c.id WHERE c.id=p_conversation_id AND c.is_group AND m.user_id=auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.chat_group_owner(p_conversation_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT c.created_by FROM public.conversations c WHERE c.id=p_conversation_id AND public.chat_group_member(c.id);
$$;
CREATE OR REPLACE FUNCTION public.chat_group_admin(p_conversation_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.chat_group_member(p_conversation_id) AND EXISTS(SELECT 1 FROM public.conversations c WHERE c.id=p_conversation_id AND (c.created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.group_admins a WHERE a.conversation_id=c.id AND a.user_id=auth.uid())));
$$;

DROP FUNCTION IF EXISTS public.create_group_conversation(uuid,text,uuid[]);
CREATE OR REPLACE FUNCTION public.create_group_conversation(_creator_id uuid,_group_name text,_member_ids uuid[],_request_id uuid DEFAULT gen_random_uuid()) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE group_id uuid;request_row public.chat_group_requests%ROWTYPE;members uuid[];
BEGIN
  IF auth.uid() IS NULL OR _creator_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';END IF;
  IF _request_id IS NULL OR length(btrim(COALESCE(_group_name,''))) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid group name or request' USING ERRCODE='22023';END IF;
  SELECT array_agg(DISTINCT id) INTO members FROM unnest(COALESCE(_member_ids,'{}'::uuid[])) id WHERE id IS NOT NULL AND id<>auth.uid();
  IF COALESCE(cardinality(members),0) NOT BETWEEN 1 AND 199 THEN RAISE EXCEPTION 'Choose between 1 and 199 members' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM unnest(members) candidate(user_id) WHERE NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=candidate.user_id)) THEN RAISE EXCEPTION 'Member unavailable' USING ERRCODE='22023';END IF;
  INSERT INTO public.chat_group_requests(user_id,request_id,operation) VALUES(auth.uid(),_request_id,'create_group') ON CONFLICT DO NOTHING;
  SELECT * INTO request_row FROM public.chat_group_requests r WHERE r.user_id=auth.uid() AND r.request_id=_request_id FOR UPDATE;
  IF request_row.operation<>'create_group' THEN RAISE EXCEPTION 'Request already used' USING ERRCODE='22023';END IF;
  IF request_row.result_id IS NOT NULL THEN RETURN request_row.result_id;END IF;
  INSERT INTO public.conversations(is_group,group_name,created_by) VALUES(true,btrim(_group_name),auth.uid()) RETURNING id INTO group_id;
  INSERT INTO public.conversation_members(conversation_id,user_id) VALUES(group_id,auth.uid());
  INSERT INTO public.conversation_members(conversation_id,user_id) SELECT group_id,id FROM unnest(members) id ON CONFLICT(conversation_id,user_id) DO NOTHING;
  UPDATE public.chat_group_requests SET result_id=group_id WHERE user_id=auth.uid() AND request_id=_request_id;
  RETURN group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_chat_group_members(p_conversation_id uuid,p_member_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE added integer;
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=p_conversation_id FOR UPDATE;
  IF NOT public.chat_group_admin(p_conversation_id) THEN RAISE EXCEPTION 'Admin permission required' USING ERRCODE='42501';END IF;
  IF COALESCE(cardinality(p_member_ids),0)>199 THEN RAISE EXCEPTION 'Too many members' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM unnest(p_member_ids) candidate(user_id) WHERE candidate.user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=candidate.user_id)) THEN RAISE EXCEPTION 'Member unavailable' USING ERRCODE='22023';END IF;
  INSERT INTO public.conversation_members(conversation_id,user_id) SELECT p_conversation_id,id FROM (SELECT DISTINCT unnest(p_member_ids) id) members ON CONFLICT(conversation_id,user_id) DO NOTHING;
  GET DIAGNOSTICS added=ROW_COUNT;
  RETURN added;
END;
$$;
CREATE OR REPLACE FUNCTION public.set_chat_group_admin(p_conversation_id uuid,p_user_id uuid,p_admin boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=p_conversation_id FOR UPDATE;
  IF NOT public.chat_group_admin(p_conversation_id) THEN RAISE EXCEPTION 'Admin permission required' USING ERRCODE='42501';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Member unavailable' USING ERRCODE='22023';END IF;
  IF NOT p_admin AND public.chat_group_owner(p_conversation_id)=p_user_id THEN RAISE EXCEPTION 'The owner cannot be demoted' USING ERRCODE='42501';END IF;
  IF p_admin THEN INSERT INTO public.group_admins(conversation_id,user_id) VALUES(p_conversation_id,p_user_id) ON CONFLICT(conversation_id,user_id) DO NOTHING;
  ELSE
    DELETE FROM public.group_admins WHERE conversation_id=p_conversation_id AND user_id=p_user_id;
    UPDATE public.chat_group_invites SET revoked_at=COALESCE(revoked_at,now()) WHERE conversation_id=p_conversation_id AND created_by=p_user_id;
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.remove_group_member(_conversation_id uuid,_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=_conversation_id FOR UPDATE;
  IF NOT public.chat_group_member(_conversation_id) OR (_user_id IS DISTINCT FROM auth.uid() AND NOT public.chat_group_admin(_conversation_id)) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';END IF;
  IF public.chat_group_owner(_conversation_id)=_user_id THEN RAISE EXCEPTION 'Transfer ownership before leaving' USING ERRCODE='42501';END IF;
  DELETE FROM public.group_admins WHERE conversation_id=_conversation_id AND user_id=_user_id;
  DELETE FROM public.group_mutes WHERE conversation_id=_conversation_id AND user_id=_user_id;
  DELETE FROM public.conversation_members WHERE conversation_id=_conversation_id AND user_id=_user_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.transfer_chat_group_ownership(p_conversation_id uuid,p_new_owner uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=p_conversation_id FOR UPDATE;
  IF auth.uid() IS NULL OR public.chat_group_owner(p_conversation_id) IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Owner permission required' USING ERRCODE='42501';END IF;
  IF p_new_owner IS NULL OR NOT EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND user_id=p_new_owner) THEN RAISE EXCEPTION 'Choose an existing member' USING ERRCODE='22023';END IF;
  INSERT INTO public.group_admins(conversation_id,user_id) VALUES(p_conversation_id,auth.uid()),(p_conversation_id,p_new_owner) ON CONFLICT(conversation_id,user_id) DO NOTHING;
  UPDATE public.conversations SET created_by=p_new_owner WHERE id=p_conversation_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.update_chat_group(p_conversation_id uuid,p_name text DEFAULT NULL,p_description text DEFAULT NULL,p_avatar_url text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=p_conversation_id FOR UPDATE;
  IF NOT public.chat_group_admin(p_conversation_id) THEN RAISE EXCEPTION 'Admin permission required' USING ERRCODE='42501';END IF;
  IF (p_name IS NOT NULL AND length(btrim(p_name)) NOT BETWEEN 1 AND 80) OR length(COALESCE(p_description,''))>1000 THEN RAISE EXCEPTION 'Invalid group details' USING ERRCODE='22023';END IF;
  IF p_avatar_url IS NOT NULL AND p_avatar_url !~ '^https?://' THEN RAISE EXCEPTION 'Invalid avatar URL' USING ERRCODE='22023';END IF;
  UPDATE public.conversations SET group_name=COALESCE(btrim(p_name),group_name),description=COALESCE(p_description,description),group_avatar_url=COALESCE(p_avatar_url,group_avatar_url) WHERE id=p_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_chat_group_invite(p_conversation_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE invite public.chat_group_invites%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=p_conversation_id FOR UPDATE;
  IF NOT public.chat_group_admin(p_conversation_id) THEN RAISE EXCEPTION 'Admin permission required' USING ERRCODE='42501';END IF;
  SELECT * INTO invite FROM public.chat_group_invites WHERE conversation_id=p_conversation_id AND created_by=auth.uid() AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1;
  IF invite.token IS NULL THEN INSERT INTO public.chat_group_invites(conversation_id,created_by,expires_at) VALUES(p_conversation_id,auth.uid(),now()+interval '7 days') RETURNING * INTO invite;END IF;
  RETURN jsonb_build_object('token',invite.token,'expires_at',invite.expires_at);
END;
$$;
CREATE OR REPLACE FUNCTION public.get_chat_group_invite(p_token uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;
  SELECT jsonb_build_object('name',c.group_name,'avatar_url',c.group_avatar_url,'expires_at',i.expires_at,'member_count',(SELECT count(*) FROM public.conversation_members m WHERE m.conversation_id=c.id),'already_member',public.chat_group_member(c.id)) INTO result
    FROM public.chat_group_invites i JOIN public.conversations c ON c.id=i.conversation_id WHERE i.token=p_token AND i.revoked_at IS NULL AND i.expires_at>now() AND c.is_group;
  IF result IS NULL THEN RAISE EXCEPTION 'Invitation expired or unavailable' USING ERRCODE='22023';END IF;
  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION public.join_chat_group(p_token uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE invite public.chat_group_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;
  SELECT * INTO invite FROM public.chat_group_invites WHERE token=p_token;
  IF invite.token IS NULL THEN RAISE EXCEPTION 'Invitation expired or unavailable' USING ERRCODE='22023';END IF;
  -- Group changes and joins always lock the group before the invite.
  PERFORM 1 FROM public.conversations WHERE id=invite.conversation_id FOR UPDATE;
  SELECT * INTO invite FROM public.chat_group_invites WHERE token=p_token FOR UPDATE;
  IF invite.token IS NULL OR invite.revoked_at IS NOT NULL OR invite.expires_at<=now() THEN RAISE EXCEPTION 'Invitation expired or unavailable' USING ERRCODE='22023';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.conversations WHERE id=invite.conversation_id AND is_group) THEN RAISE EXCEPTION 'Group unavailable' USING ERRCODE='22023';END IF;
  INSERT INTO public.conversation_members(conversation_id,user_id) VALUES(invite.conversation_id,auth.uid()) ON CONFLICT(conversation_id,user_id) DO NOTHING;
  RETURN invite.conversation_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.revoke_chat_group_invite(p_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE group_id uuid;
BEGIN
  SELECT conversation_id INTO group_id FROM public.chat_group_invites WHERE token=p_token;
  PERFORM 1 FROM public.conversations WHERE id=group_id FOR UPDATE;
  IF NOT public.chat_group_admin(group_id) THEN RAISE EXCEPTION 'Admin permission required' USING ERRCODE='42501';END IF;
  UPDATE public.chat_group_invites SET revoked_at=now() WHERE token=p_token;
END;
$$;

-- Even legacy direct self-leave requests must remove stale administrator rights.
CREATE OR REPLACE FUNCTION public.cleanup_chat_group_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF public.chat_is_group(OLD.conversation_id) THEN
    DELETE FROM public.group_admins WHERE conversation_id=OLD.conversation_id AND user_id=OLD.user_id;
    DELETE FROM public.group_mutes WHERE conversation_id=OLD.conversation_id AND user_id=OLD.user_id;
    UPDATE public.chat_group_invites SET revoked_at=COALESCE(revoked_at,now()) WHERE conversation_id=OLD.conversation_id AND created_by=OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_chat_group_membership() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS chat_group_membership_cleanup ON public.conversation_members;
CREATE TRIGGER chat_group_membership_cleanup AFTER DELETE ON public.conversation_members FOR EACH ROW EXECUTE FUNCTION public.cleanup_chat_group_membership();

CREATE OR REPLACE FUNCTION public.create_chat_group_poll(p_conversation_id uuid,p_question text,p_options text[],p_anonymous boolean,p_multiple boolean,p_request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE poll_id uuid;request_row public.chat_group_requests%ROWTYPE;options_json jsonb;
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=p_conversation_id FOR UPDATE;
  IF NOT public.chat_group_member(p_conversation_id) THEN RAISE EXCEPTION 'Group membership required' USING ERRCODE='42501';END IF;
  IF p_request_id IS NULL OR length(btrim(COALESCE(p_question,''))) NOT BETWEEN 1 AND 300 OR COALESCE(cardinality(p_options),0) NOT BETWEEN 2 AND 10 OR EXISTS(SELECT 1 FROM unnest(p_options) option WHERE length(btrim(COALESCE(option,''))) NOT BETWEEN 1 AND 160) THEN RAISE EXCEPTION 'Invalid poll' USING ERRCODE='22023';END IF;
  INSERT INTO public.chat_group_requests(user_id,request_id,operation) VALUES(auth.uid(),p_request_id,'create_poll') ON CONFLICT DO NOTHING;
  SELECT * INTO request_row FROM public.chat_group_requests r WHERE r.user_id=auth.uid() AND r.request_id=p_request_id FOR UPDATE;
  IF request_row.operation<>'create_poll' THEN RAISE EXCEPTION 'Request already used' USING ERRCODE='22023';END IF;
  IF request_row.result_id IS NOT NULL THEN RETURN request_row.result_id;END IF;
  SELECT jsonb_agg(jsonb_build_object('id','opt_'||(ordinality-1),'text',btrim(option)) ORDER BY ordinality) INTO options_json FROM unnest(p_options) WITH ORDINALITY option(option,ordinality);
  INSERT INTO public.group_polls(conversation_id,creator_id,question,options,is_anonymous,is_multiple_choice) VALUES(p_conversation_id,auth.uid(),btrim(p_question),options_json,p_anonymous,p_multiple) RETURNING id INTO poll_id;
  INSERT INTO public.messages(conversation_id,sender_id,content,message_type,attachment_url) VALUES(p_conversation_id,auth.uid(),btrim(p_question),'poll',poll_id::text);
  UPDATE public.chat_group_requests SET result_id=poll_id WHERE user_id=auth.uid() AND request_id=p_request_id;
  RETURN poll_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.set_chat_poll_vote(p_poll_id uuid,p_option_id text,p_selected boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE poll public.group_polls%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=(SELECT conversation_id FROM public.group_polls WHERE id=p_poll_id) FOR UPDATE;
  SELECT * INTO poll FROM public.group_polls WHERE id=p_poll_id FOR UPDATE;
  IF poll.id IS NULL OR NOT public.chat_group_member(poll.conversation_id) THEN RAISE EXCEPTION 'Group membership required' USING ERRCODE='42501';END IF;
  IF poll.status<>'active' THEN RAISE EXCEPTION 'Poll has ended' USING ERRCODE='22023';END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(poll.options) option WHERE option->>'id'=p_option_id) THEN RAISE EXCEPTION 'Invalid option' USING ERRCODE='22023';END IF;
  IF p_selected THEN
    IF NOT poll.is_multiple_choice THEN DELETE FROM public.poll_votes WHERE poll_id=p_poll_id AND user_id=auth.uid() AND option_id<>p_option_id;END IF;
    INSERT INTO public.poll_votes(poll_id,user_id,option_id) VALUES(p_poll_id,auth.uid(),p_option_id) ON CONFLICT(poll_id,user_id,option_id) DO NOTHING;
  ELSE DELETE FROM public.poll_votes WHERE poll_id=p_poll_id AND user_id=auth.uid() AND option_id=p_option_id;END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.end_chat_group_poll(p_poll_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE poll public.group_polls%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=(SELECT conversation_id FROM public.group_polls WHERE id=p_poll_id) FOR UPDATE;
  SELECT * INTO poll FROM public.group_polls WHERE id=p_poll_id FOR UPDATE;
  IF poll.id IS NULL OR NOT public.chat_group_member(poll.conversation_id) OR poll.creator_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Poll creator permission required' USING ERRCODE='42501';END IF;
  UPDATE public.group_polls SET status='ended',ended_at=COALESCE(ended_at,now()) WHERE id=p_poll_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_chat_group_poll(p_poll_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE poll public.group_polls%ROWTYPE;counts jsonb;selected jsonb;total bigint;
BEGIN
  SELECT * INTO poll FROM public.group_polls WHERE id=p_poll_id;
  IF poll.id IS NULL OR NOT public.chat_group_member(poll.conversation_id) THEN RAISE EXCEPTION 'Group membership required' USING ERRCODE='42501';END IF;
  SELECT count(*) INTO total FROM public.poll_votes WHERE poll_id=p_poll_id;
  SELECT COALESCE(jsonb_object_agg(option_id,n),'{}'::jsonb) INTO counts FROM (SELECT option_id,count(*) n FROM public.poll_votes WHERE poll_id=p_poll_id GROUP BY option_id) v;
  SELECT COALESCE(jsonb_agg(option_id),'[]'::jsonb) INTO selected FROM public.poll_votes WHERE poll_id=p_poll_id AND user_id=auth.uid();
  RETURN to_jsonb(poll)||jsonb_build_object('total_vote_count',total,'option_vote_counts',counts,'user_option_ids',selected);
END;
$$;
CREATE OR REPLACE FUNCTION public.get_chat_group_polls(p_conversation_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.chat_group_member(p_conversation_id) THEN RAISE EXCEPTION 'Group membership required' USING ERRCODE='42501';END IF;
  SELECT COALESCE(jsonb_agg(public.get_chat_group_poll(p.id) ORDER BY p.created_at DESC),'[]'::jsonb) INTO result FROM public.group_polls p WHERE p.conversation_id=p_conversation_id;
  RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_chat_poll_voters(p_poll_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE poll public.group_polls%ROWTYPE;result jsonb;
BEGIN
  SELECT * INTO poll FROM public.group_polls WHERE id=p_poll_id;
  IF poll.id IS NULL OR poll.is_anonymous OR poll.creator_id IS DISTINCT FROM auth.uid() OR NOT public.chat_group_member(poll.conversation_id) THEN RAISE EXCEPTION 'Voter details unavailable' USING ERRCODE='42501';END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id',v.user_id,'option_id',v.option_id,'profile',jsonb_build_object('name',p.name,'username',p.username,'avatar_url',p.avatar_url,'initials',p.initials))),'[]'::jsonb) INTO result FROM public.poll_votes v LEFT JOIN public.profiles p ON p.id=v.user_id WHERE v.poll_id=p_poll_id;
  RETURN result;
END;
$$;

-- Restrictive policies constrain permissive policies from earlier deployments too.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_group_conversations_read ON public.conversations;
CREATE POLICY chat_group_conversations_read ON public.conversations FOR SELECT TO authenticated USING(public.chat_group_member(id));
DROP POLICY IF EXISTS chat_group_conversations_update ON public.conversations;
CREATE POLICY chat_group_conversations_update ON public.conversations FOR UPDATE TO authenticated USING(public.chat_group_member(id)) WITH CHECK(public.chat_group_member(id));
DROP POLICY IF EXISTS chat_group_conversation_read_guard ON public.conversations;
CREATE POLICY chat_group_conversation_read_guard ON public.conversations AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT is_group OR public.chat_group_member(id));
DROP POLICY IF EXISTS chat_group_conversation_update_guard ON public.conversations;
CREATE POLICY chat_group_conversation_update_guard ON public.conversations AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT is_group OR public.chat_group_member(id)) WITH CHECK(NOT is_group OR public.chat_group_member(id));
DROP POLICY IF EXISTS chat_group_conversation_insert_guard ON public.conversations;
CREATE POLICY chat_group_conversation_insert_guard ON public.conversations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_group);
DROP POLICY IF EXISTS chat_group_conversation_delete_guard ON public.conversations;
CREATE POLICY chat_group_conversation_delete_guard ON public.conversations AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT is_group);
DROP POLICY IF EXISTS chat_group_members_read ON public.conversation_members;
CREATE POLICY chat_group_members_read ON public.conversation_members FOR SELECT TO authenticated USING(public.chat_group_member(conversation_id));
DROP POLICY IF EXISTS chat_group_members_insert_guard ON public.conversation_members;
CREATE POLICY chat_group_members_insert_guard ON public.conversation_members AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT public.chat_is_group(conversation_id) OR public.chat_group_admin(conversation_id));
DROP POLICY IF EXISTS chat_group_members_delete_guard ON public.conversation_members;
CREATE POLICY chat_group_members_delete_guard ON public.conversation_members AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT public.chat_is_group(conversation_id) OR (public.chat_group_member(conversation_id) AND user_id IS DISTINCT FROM public.chat_group_owner(conversation_id) AND (user_id=auth.uid() OR public.chat_group_admin(conversation_id))));
DROP POLICY IF EXISTS chat_group_members_identity_guard ON public.conversation_members;
CREATE POLICY chat_group_members_identity_guard ON public.conversation_members AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT public.chat_is_group(conversation_id)) WITH CHECK(NOT public.chat_is_group(conversation_id));

CREATE OR REPLACE FUNCTION public.guard_chat_group_update() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE table_owner text;
BEGIN
  SELECT pg_get_userbyid(relowner) INTO table_owner FROM pg_class WHERE oid=TG_RELID;
  IF current_user=table_owner THEN RETURN NEW;END IF;
  IF OLD.is_group OR NEW.is_group THEN
    IF (to_jsonb(NEW)-ARRAY['group_name','group_avatar_url','description','pinned_message_id','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['group_name','group_avatar_url','description','pinned_message_id','updated_at']) THEN RAISE EXCEPTION 'Protected group fields cannot change' USING ERRCODE='42501';END IF;
    IF ROW(NEW.group_name,NEW.group_avatar_url,NEW.description) IS DISTINCT FROM ROW(OLD.group_name,OLD.group_avatar_url,OLD.description) AND NOT public.chat_group_admin(OLD.id) THEN RAISE EXCEPTION 'Admin permission required' USING ERRCODE='42501';END IF;
    IF NEW.pinned_message_id IS DISTINCT FROM OLD.pinned_message_id AND NEW.pinned_message_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.messages m WHERE m.id=NEW.pinned_message_id AND m.conversation_id=OLD.id AND NOT COALESCE(m.deleted_for_everyone,false)) THEN RAISE EXCEPTION 'Pinned message unavailable' USING ERRCODE='22023';END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chat_group_update_guard ON public.conversations;
CREATE TRIGGER chat_group_update_guard BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.guard_chat_group_update();

ALTER TABLE public.group_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_group_admins_read ON public.group_admins;
CREATE POLICY chat_group_admins_read ON public.group_admins FOR SELECT TO authenticated USING(public.chat_group_member(conversation_id));
DROP POLICY IF EXISTS chat_group_admins_read_guard ON public.group_admins;
CREATE POLICY chat_group_admins_read_guard ON public.group_admins AS RESTRICTIVE FOR SELECT TO authenticated USING(public.chat_group_member(conversation_id));
DROP POLICY IF EXISTS chat_group_admins_write_guard ON public.group_admins;
DROP POLICY IF EXISTS chat_group_admins_insert_guard ON public.group_admins;
CREATE POLICY chat_group_admins_insert_guard ON public.group_admins AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.chat_group_admin(conversation_id) AND EXISTS(SELECT 1 FROM public.conversation_members m WHERE m.conversation_id=group_admins.conversation_id AND m.user_id=group_admins.user_id));
DROP POLICY IF EXISTS chat_group_admins_update_guard ON public.group_admins;
CREATE POLICY chat_group_admins_update_guard ON public.group_admins AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.chat_group_admin(conversation_id)) WITH CHECK(public.chat_group_admin(conversation_id) AND EXISTS(SELECT 1 FROM public.conversation_members m WHERE m.conversation_id=group_admins.conversation_id AND m.user_id=group_admins.user_id));
DROP POLICY IF EXISTS chat_group_admins_delete_guard ON public.group_admins;
CREATE POLICY chat_group_admins_delete_guard ON public.group_admins AS RESTRICTIVE FOR DELETE TO authenticated USING(public.chat_group_admin(conversation_id) AND user_id IS DISTINCT FROM public.chat_group_owner(conversation_id));
DROP POLICY IF EXISTS chat_group_mutes_self ON public.group_mutes;
CREATE POLICY chat_group_mutes_self ON public.group_mutes FOR ALL TO authenticated USING(user_id=auth.uid() AND public.chat_group_member(conversation_id)) WITH CHECK(user_id=auth.uid() AND public.chat_group_member(conversation_id));
DROP POLICY IF EXISTS chat_group_mutes_guard ON public.group_mutes;
CREATE POLICY chat_group_mutes_guard ON public.group_mutes AS RESTRICTIVE FOR ALL TO authenticated USING(user_id=auth.uid() AND public.chat_group_member(conversation_id)) WITH CHECK(user_id=auth.uid() AND public.chat_group_member(conversation_id));
DROP POLICY IF EXISTS chat_group_polls_read ON public.group_polls;
CREATE POLICY chat_group_polls_read ON public.group_polls FOR SELECT TO authenticated USING(public.chat_group_member(conversation_id));
DROP POLICY IF EXISTS chat_group_polls_read_guard ON public.group_polls;
CREATE POLICY chat_group_polls_read_guard ON public.group_polls AS RESTRICTIVE FOR SELECT TO authenticated USING(public.chat_group_member(conversation_id));
DROP POLICY IF EXISTS chat_group_polls_insert_guard ON public.group_polls;
CREATE POLICY chat_group_polls_insert_guard ON public.group_polls AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
DROP POLICY IF EXISTS chat_group_polls_update_guard ON public.group_polls;
CREATE POLICY chat_group_polls_update_guard ON public.group_polls AS RESTRICTIVE FOR UPDATE TO authenticated USING(false);
DROP POLICY IF EXISTS chat_group_polls_delete_guard ON public.group_polls;
CREATE POLICY chat_group_polls_delete_guard ON public.group_polls AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
DROP POLICY IF EXISTS chat_poll_votes_read ON public.poll_votes;
CREATE POLICY chat_poll_votes_read ON public.poll_votes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.group_polls p WHERE p.id=poll_id AND public.chat_group_member(p.conversation_id) AND (user_id=auth.uid() OR (p.creator_id=auth.uid() AND NOT p.is_anonymous))));
DROP POLICY IF EXISTS chat_poll_votes_read_guard ON public.poll_votes;
CREATE POLICY chat_poll_votes_read_guard ON public.poll_votes AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.group_polls p WHERE p.id=poll_id AND public.chat_group_member(p.conversation_id) AND (user_id=auth.uid() OR (p.creator_id=auth.uid() AND NOT p.is_anonymous))));
DROP POLICY IF EXISTS chat_poll_votes_insert_guard ON public.poll_votes;
CREATE POLICY chat_poll_votes_insert_guard ON public.poll_votes AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
DROP POLICY IF EXISTS chat_poll_votes_update_guard ON public.poll_votes;
CREATE POLICY chat_poll_votes_update_guard ON public.poll_votes AS RESTRICTIVE FOR UPDATE TO authenticated USING(false);
DROP POLICY IF EXISTS chat_poll_votes_delete_guard ON public.poll_votes;
CREATE POLICY chat_poll_votes_delete_guard ON public.poll_votes AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
DROP POLICY IF EXISTS chat_invites_admin_read ON public.chat_group_invites;
CREATE POLICY chat_invites_admin_read ON public.chat_group_invites FOR SELECT TO authenticated USING(public.chat_group_admin(conversation_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.group_admins,public.group_mutes,public.group_polls,public.poll_votes TO authenticated;
REVOKE ALL ON public.chat_group_invites FROM authenticated;
GRANT SELECT ON public.chat_group_invites TO authenticated;
REVOKE ALL ON public.group_admins,public.group_mutes,public.group_polls,public.poll_votes,public.chat_group_invites FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.chat_group_avatar_admin(p_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT CASE WHEN split_part(p_path,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN public.chat_group_admin(split_part(p_path,'/',1)::uuid) ELSE false END;
$$;
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id,name,public) VALUES('group-avatars','group-avatars',true) ON CONFLICT(id) DO NOTHING;
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS chat_group_avatar_insert_guard ON storage.objects;
    CREATE POLICY chat_group_avatar_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'group-avatars' OR public.chat_group_avatar_admin(name));
    DROP POLICY IF EXISTS chat_group_avatar_update_guard ON storage.objects;
    CREATE POLICY chat_group_avatar_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'group-avatars' OR public.chat_group_avatar_admin(name)) WITH CHECK(bucket_id<>'group-avatars' OR public.chat_group_avatar_admin(name));
    DROP POLICY IF EXISTS chat_group_avatar_delete_guard ON storage.objects;
    CREATE POLICY chat_group_avatar_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'group-avatars' OR public.chat_group_avatar_admin(name));
  END IF;
END $$;

-- Lock down the default PUBLIC execute grants on every new endpoint/helper.
DO $$ DECLARE fn record; BEGIN
  FOR fn IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY(ARRAY[
    'chat_is_group','chat_group_member','chat_group_owner','chat_group_admin','chat_group_avatar_admin','create_group_conversation','add_chat_group_members','set_chat_group_admin','remove_group_member','transfer_chat_group_ownership','update_chat_group','create_chat_group_invite','get_chat_group_invite','join_chat_group','revoke_chat_group_invite','create_chat_group_poll','set_chat_poll_vote','end_chat_group_poll','get_chat_group_poll','get_chat_group_polls','get_chat_poll_voters'
  ]) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',fn.signature);
  END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
NOTIFY pgrst,'reload schema';
COMMIT;
