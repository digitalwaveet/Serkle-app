-- Membership writes are server decisions. Keep one row per Circle/user, including
-- historical decisions; retries must never create a second request or self-approve.
ALTER TABLE public.circle_members DROP CONSTRAINT IF EXISTS circle_members_status_check;
ALTER TABLE public.circle_members ADD CONSTRAINT circle_members_status_check
  CHECK (status IN ('active', 'pending', 'banned', 'removed', 'left', 'declined'));
REVOKE INSERT, UPDATE, DELETE ON public.circle_members FROM PUBLIC, anon, authenticated;

CREATE TABLE public.circle_join_intents (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE public.circle_join_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_join_intents FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_circle_members(_circle_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM circles c LEFT JOIN circle_members m
      ON m.circle_id=c.id AND m.user_id=_user_id AND m.status='active'
    WHERE c.id=_circle_id AND (c.creator_id=_user_id OR m.role IN ('creator','admin'))
  );
$$;

CREATE OR REPLACE FUNCTION public.get_circle_membership_state(_circle_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles; m circle_members; u uuid := auth.uid(); s boolean; state text;
BEGIN
  SELECT * INTO c FROM circles WHERE id=_circle_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('circle_id',_circle_id,'user_id',u,'state','unavailable'); END IF;
  SELECT * INTO m FROM circle_members WHERE circle_id=c.id AND user_id=u;
  s := COALESCE(has_circle_subscription(c.id,u),false);
  state := CASE
    WHEN u IS NULL THEN 'guest'
    WHEN c.creator_id=u THEN 'owner'
    WHEN NOT COALESCE(c.is_active,false) THEN 'unavailable'
    WHEN m.status IN ('banned','removed') THEN 'restricted'
    WHEN m.status='active' AND m.role IN ('creator','admin') THEN 'manager'
    WHEN m.status='active' THEN 'joined'
    WHEN m.status='pending' THEN 'pending'
    WHEN c.subscription_enabled AND c.subscription_method='before_join' AND NOT s THEN 'subscription_required'
    ELSE 'join' END;
  RETURN jsonb_build_object('circle_id',c.id,'creator_id',c.creator_id,'user_id',u,'state',state,
    'status',m.status,'role',m.role,'has_subscription',s,
    'premium_locked',COALESCE(c.subscription_enabled,false) AND NOT s AND state<>'owner');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_circle_membership_states(_circle_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF cardinality(_circle_ids)>100 THEN RAISE EXCEPTION 'Request at most 100 Circles'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(get_circle_membership_state(id)) FROM (SELECT DISTINCT unnest(_circle_ids) id) ids),'[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_circle(_circle_id uuid, _request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles; m circle_members; u uuid := auth.uid(); prior uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Please log in to join a Circle' USING ERRCODE='42501'; END IF;
  IF _request_id IS NULL THEN RAISE EXCEPTION 'Request ID required'; END IF;
  -- All transitions lock the Circle first, serializing join/leave/approval/transfer.
  SELECT * INTO c FROM circles WHERE id=_circle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Circle unavailable'; END IF;
  SELECT circle_id INTO prior FROM circle_join_intents WHERE user_id=u AND request_id=_request_id;
  IF FOUND THEN
    IF prior<>c.id THEN RAISE EXCEPTION 'Request ID belongs to another Circle'; END IF;
    RETURN get_circle_membership_state(c.id);
  END IF;
  IF c.creator_id=u THEN RETURN get_circle_membership_state(c.id); END IF;
  IF NOT COALESCE(c.is_active,false) THEN RAISE EXCEPTION 'Circle unavailable'; END IF;
  SELECT * INTO m FROM circle_members WHERE circle_id=c.id AND user_id=u;
  IF m.status IN ('banned','removed') THEN RAISE EXCEPTION 'Membership is restricted' USING ERRCODE='42501'; END IF;
  IF m.status IN ('active','pending') THEN
    INSERT INTO circle_join_intents(user_id,request_id,circle_id) VALUES(u,_request_id,c.id);
    RETURN get_circle_membership_state(c.id);
  END IF;
  IF c.subscription_enabled AND c.subscription_method='before_join' AND NOT has_circle_subscription(c.id,u) THEN
    RETURN get_circle_membership_state(c.id);
  END IF;
  INSERT INTO circle_join_intents(user_id,request_id,circle_id) VALUES(u,_request_id,c.id);
  INSERT INTO circle_members(circle_id,user_id,role,status)
    VALUES(c.id,u,'member',CASE WHEN c.is_private THEN 'pending' ELSE 'active' END)
    ON CONFLICT(circle_id,user_id) DO UPDATE SET role='member',status=EXCLUDED.status,joined_at=now();
  RETURN get_circle_membership_state(c.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_circle(_circle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles; u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Please log in' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM circles WHERE id=_circle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Circle unavailable'; END IF;
  IF c.creator_id=u THEN RAISE EXCEPTION 'Transfer ownership before leaving your Circle' USING ERRCODE='42501'; END IF;
  UPDATE circle_members SET status='left',role='member'
    WHERE circle_id=c.id AND user_id=u AND status IN ('active','pending');
  RETURN get_circle_membership_state(c.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_circle_join_request(_circle_id uuid,_user_id uuid,_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles;
BEGIN
  SELECT * INTO c FROM circles WHERE id=_circle_id FOR UPDATE;
  IF NOT FOUND OR NOT can_manage_circle_members(_circle_id,auth.uid()) THEN
    RAISE EXCEPTION 'Only Circle managers can respond to requests' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM circle_members WHERE circle_id=c.id AND user_id=_user_id AND status='pending') THEN RETURN; END IF;
  IF _approve AND NOT COALESCE(c.is_active,false) THEN RAISE EXCEPTION 'Circle unavailable'; END IF;
  IF _approve AND c.subscription_enabled AND c.subscription_method='before_join' AND NOT has_circle_subscription(c.id,_user_id) THEN
    RAISE EXCEPTION 'The requester must renew their subscription before approval';
  END IF;
  UPDATE circle_members SET status=CASE WHEN _approve THEN 'active' ELSE 'declined' END,
    joined_at=CASE WHEN _approve THEN now() ELSE joined_at END
    WHERE circle_id=c.id AND user_id=_user_id AND status='pending';
  IF _approve THEN
    INSERT INTO push_notifications(user_id,title,body,notification_type,data,sent_at)
      VALUES(_user_id,'Request approved','You are now a member of '||c.name,'circle_join_approved',jsonb_build_object('circle_id',c.id),now());
  END IF;
END;
$$;

-- Creation and ownership changes keep authoritative ownership and membership
-- atomic. Trigger name sorts after the existing on_circle_created stats trigger.
CREATE OR REPLACE FUNCTION public.sync_circle_owner_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.creator_id=NEW.creator_id THEN RETURN NEW; END IF;
  INSERT INTO circle_members(circle_id,user_id,role,status) VALUES(NEW.id,NEW.creator_id,'creator','active')
    ON CONFLICT(circle_id,user_id) DO UPDATE SET role='creator',status='active';
  IF TG_OP='UPDATE' THEN
    UPDATE circle_members SET role='member' WHERE circle_id=NEW.id AND user_id=OLD.creator_id AND role='creator';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_circle_owner_membership AFTER INSERT OR UPDATE OF creator_id ON circles
  FOR EACH ROW EXECUTE FUNCTION sync_circle_owner_membership();

-- These policies expose membership/preview metadata only; content retains its
-- existing independent membership and premium entitlement checks.
CREATE POLICY circle_members_self_read ON circle_members FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY circle_members_manager_read ON circle_members FOR SELECT TO authenticated USING(can_manage_circle_members(circle_id,auth.uid()));
CREATE POLICY circle_requester_preview ON circles FOR SELECT TO authenticated USING(
  creator_id=auth.uid() OR has_circle_subscription(id,auth.uid())
  OR (get_circle_membership_state(id)->>'status') IN ('active','pending')
);
CREATE OR REPLACE FUNCTION public.get_circle_invite_preview(_invite_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('id',c.id,'name',c.name,'description',c.description,
    'avatar_url',c.avatar_url,'category',c.category,'creator_id',c.creator_id,'is_private',c.is_private,
    'subscription_enabled',c.subscription_enabled,'subscription_method',c.subscription_method,
    'subscription_price',c.subscription_price,'members_count',COALESCE(s.members_count,0),
    'membership_state',get_circle_membership_state(c.id))
  FROM circles c LEFT JOIN circle_stats s ON s.circle_id=c.id
  WHERE c.invite_code=_invite_code AND c.is_active AND auth.uid() IS NOT NULL;
$$;

-- Existing admin/ownership invitations must not be a role escalation bypass.
REVOKE INSERT, UPDATE, DELETE ON circle_invitations FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.send_circle_invitation(_circle_id uuid,_invitee_id uuid,_type text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles; invitation_id uuid;
BEGIN
  SELECT * INTO c FROM circles WHERE id=_circle_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR c.creator_id<>auth.uid() THEN
    RAISE EXCEPTION 'Only the owner can invite managers or transfer ownership' USING ERRCODE='42501';
  END IF;
  IF _type NOT IN ('admin','transfer_ownership') OR _invitee_id=auth.uid() THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
  SELECT id INTO invitation_id FROM circle_invitations WHERE circle_id=c.id AND inviter_id=auth.uid()
    AND invitee_id=_invitee_id AND invitation_type=_type AND status='pending' ORDER BY created_at LIMIT 1;
  IF invitation_id IS NULL THEN
    INSERT INTO circle_invitations(circle_id,inviter_id,invitee_id,invitation_type)
      VALUES(c.id,auth.uid(),_invitee_id,_type) RETURNING id INTO invitation_id;
  END IF;
  RETURN invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_circle_invitation(_invitation_id uuid,_accept boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE i circle_invitations; c circles; u uuid := auth.uid();
BEGIN
  SELECT * INTO i FROM circle_invitations WHERE id=_invitation_id;
  IF NOT FOUND OR u IS NULL OR i.invitee_id<>u THEN RAISE EXCEPTION 'Invitation not authorized' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM circles WHERE id=i.circle_id FOR UPDATE;
  SELECT * INTO i FROM circle_invitations WHERE id=_invitation_id FOR UPDATE;
  IF i.status<>'pending' THEN RETURN i.status='accepted'; END IF;
  IF NOT _accept THEN UPDATE circle_invitations SET status='declined',responded_at=now() WHERE id=i.id; RETURN false; END IF;
  IF NOT COALESCE(c.is_active,false) OR c.creator_id<>i.inviter_id THEN RAISE EXCEPTION 'Invitation is no longer valid'; END IF;
  IF EXISTS(SELECT 1 FROM circle_members WHERE circle_id=c.id AND user_id=u AND status IN ('banned','removed')) THEN
    RAISE EXCEPTION 'Membership is restricted' USING ERRCODE='42501';
  END IF;
  IF i.invitation_type='transfer_ownership' THEN
    UPDATE circles SET creator_id=u WHERE id=c.id;
  ELSIF c.creator_id<>u THEN
    INSERT INTO circle_members(circle_id,user_id,role,status) VALUES(c.id,u,'admin','active')
      ON CONFLICT(circle_id,user_id) DO UPDATE SET role='admin',status='active';
  END IF;
  UPDATE circle_invitations SET status='accepted',responded_at=now() WHERE id=i.id;
  RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.accept_circle_invitation(_invitation_id uuid,_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid()<>_user_id THEN RAISE EXCEPTION 'Invitation not authorized' USING ERRCODE='42501'; END IF;
  RETURN respond_circle_invitation(_invitation_id,true);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_circle_member(_circle_id uuid,_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles;
BEGIN
  SELECT * INTO c FROM circles WHERE id=_circle_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT is_any_admin(auth.uid()) THEN RAISE EXCEPTION 'Platform admin required' USING ERRCODE='42501'; END IF;
  IF c.creator_id=_user_id THEN RAISE EXCEPTION 'The Circle owner cannot be removed'; END IF;
  UPDATE circle_members SET status='removed' WHERE circle_id=c.id AND user_id=_user_id;
END;
$$;

REVOKE ALL ON FUNCTION join_circle(uuid,uuid),leave_circle(uuid),respond_circle_join_request(uuid,uuid,boolean),
  send_circle_invitation(uuid,uuid,text),respond_circle_invitation(uuid,boolean),accept_circle_invitation(uuid,uuid),
  remove_circle_member(uuid,uuid),get_circle_invite_preview(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION join_circle(uuid,uuid),leave_circle(uuid),respond_circle_join_request(uuid,uuid,boolean),
  send_circle_invitation(uuid,uuid,text),respond_circle_invitation(uuid,boolean),accept_circle_invitation(uuid,uuid),
  remove_circle_member(uuid,uuid),get_circle_invite_preview(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_circle_membership_state(uuid),get_circle_membership_states(uuid[]) TO authenticated,anon;
