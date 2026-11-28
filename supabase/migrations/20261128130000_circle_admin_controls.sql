ALTER TABLE public.circle_members
  ADD COLUMN can_invite_members boolean NOT NULL DEFAULT true,
  ADD COLUMN can_respond_to_requests boolean NOT NULL DEFAULT true;

-- Move legacy codes out of the publicly readable Circle row. Existing shared
-- links remain valid. New admin links are tied to the issuing administrator.
CREATE TABLE public.circle_member_invite_links (
  code text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  issuer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE NULLS NOT DISTINCT (circle_id, issuer_id)
);
ALTER TABLE public.circle_member_invite_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_member_invite_links FROM PUBLIC, anon, authenticated;
INSERT INTO public.circle_member_invite_links(code, circle_id)
  SELECT invite_code, id FROM public.circles WHERE invite_code IS NOT NULL AND invite_code <> '';
DROP TRIGGER IF EXISTS set_circle_invite_code ON public.circles;
ALTER TABLE public.circles ALTER COLUMN invite_code DROP DEFAULT, ALTER COLUMN invite_code DROP NOT NULL;
UPDATE public.circles SET invite_code = NULL WHERE invite_code IS NOT NULL;
ALTER TABLE public.circles ADD CONSTRAINT circles_invite_code_retired CHECK (invite_code IS NULL);

CREATE FUNCTION public.circle_manager_can(_circle_id uuid, _user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM circles c LEFT JOIN circle_members m
      ON m.circle_id = c.id AND m.user_id = _user_id AND m.status = 'active' AND m.role = 'admin'
    WHERE c.id = _circle_id AND (
      c.creator_id = _user_id OR CASE _permission
        WHEN 'invite' THEN m.can_invite_members
        WHEN 'requests' THEN m.can_respond_to_requests
        ELSE false END
    )
  );
$$;

CREATE FUNCTION public.get_my_circle_admin_permissions(_circle_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'can_invite_members', circle_manager_can(_circle_id, auth.uid(), 'invite'),
    'can_respond_to_requests', circle_manager_can(_circle_id, auth.uid(), 'requests')
  );
$$;

CREATE FUNCTION public.get_circle_member_invite_code(_circle_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles; issuer uuid; invite text;
BEGIN
  SELECT * INTO c FROM circles WHERE id = _circle_id FOR UPDATE;
  IF NOT FOUND OR NOT COALESCE(c.is_active, false) OR NOT circle_manager_can(c.id, auth.uid(), 'invite') THEN
    RAISE EXCEPTION 'Member invite permission required' USING ERRCODE = '42501';
  END IF;
  issuer := CASE WHEN c.creator_id = auth.uid() THEN NULL ELSE auth.uid() END;
  SELECT code INTO invite FROM circle_member_invite_links
    WHERE circle_id = c.id AND issuer_id IS NOT DISTINCT FROM issuer;
  IF NOT FOUND THEN
    INSERT INTO circle_member_invite_links(circle_id, issuer_id) VALUES(c.id, issuer) RETURNING code INTO invite;
  END IF;
  RETURN invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_circle_invite_preview(_invite_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('id',c.id,'name',c.name,'description',c.description,
    'avatar_url',c.avatar_url,'category',c.category,'creator_id',c.creator_id,'is_private',c.is_private,
    'subscription_enabled',c.subscription_enabled,'subscription_method',c.subscription_method,
    'subscription_price',c.subscription_price,'members_count',COALESCE(s.members_count,0),
    'membership_state',get_circle_membership_state(c.id))
  FROM circle_member_invite_links l
  JOIN circles c ON c.id = l.circle_id LEFT JOIN circle_stats s ON s.circle_id = c.id
  WHERE l.code = _invite_code AND c.is_active AND auth.uid() IS NOT NULL
    AND (l.issuer_id IS NULL OR circle_manager_can(c.id, l.issuer_id, 'invite'));
$$;

CREATE FUNCTION public.revoke_circle_admin_invite_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.status = 'active' THEN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM circle_member_invite_links WHERE circle_id = OLD.circle_id AND issuer_id = OLD.user_id;
    ELSIF NEW.role <> 'admin' OR NEW.status <> 'active' OR NOT NEW.can_invite_members THEN
      DELETE FROM circle_member_invite_links WHERE circle_id = OLD.circle_id AND issuer_id = OLD.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER revoke_circle_admin_invite_link AFTER UPDATE OF role, status, can_invite_members OR DELETE
  ON public.circle_members FOR EACH ROW EXECUTE FUNCTION public.revoke_circle_admin_invite_link();

CREATE FUNCTION public.list_circle_admins(_circle_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM circles WHERE id = _circle_id AND creator_id = auth.uid()) THEN
    RAISE EXCEPTION 'Circle owner required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'name', p.name, 'username', p.username,
      'can_invite_members', m.can_invite_members, 'can_respond_to_requests', m.can_respond_to_requests
    ) ORDER BY p.name, m.user_id)
    FROM circle_members m JOIN profiles p ON p.id = m.user_id
    WHERE m.circle_id = _circle_id AND m.status = 'active' AND m.role = 'admin' AND m.user_id <> auth.uid()
  ), '[]'::jsonb);
END;
$$;

CREATE FUNCTION public.update_circle_admin(_circle_id uuid, _user_id uuid, _action text, _allowed boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles;
BEGIN
  SELECT * INTO c FROM circles WHERE id = _circle_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS DISTINCT FROM c.creator_id THEN
    RAISE EXCEPTION 'Circle owner required' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _user_id = c.creator_id OR _action IS NULL
      OR _action NOT IN ('remove', 'invite', 'requests') OR (_action <> 'remove' AND _allowed IS NULL) THEN
    RAISE EXCEPTION 'Invalid administrator change';
  END IF;
  UPDATE circle_members SET
    role = CASE WHEN _action = 'remove' THEN 'member' ELSE role END,
    can_invite_members = CASE WHEN _action = 'remove' THEN true WHEN _action = 'invite' THEN _allowed ELSE can_invite_members END,
    can_respond_to_requests = CASE WHEN _action = 'remove' THEN true WHEN _action = 'requests' THEN _allowed ELSE can_respond_to_requests END
    WHERE circle_id = c.id AND user_id = _user_id AND role = 'admin' AND status = 'active';
  IF _action = 'remove' THEN
    UPDATE circle_invitations SET status = 'declined', responded_at = now()
      WHERE circle_id = c.id AND invitee_id = _user_id AND invitation_type = 'admin' AND status = 'pending';
  ELSIF NOT FOUND THEN
    RAISE EXCEPTION 'This person is no longer an active Circle admin';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_circle_join_request(_circle_id uuid,_user_id uuid,_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles;
BEGIN
  SELECT * INTO c FROM circles WHERE id=_circle_id FOR UPDATE;
  IF NOT FOUND OR NOT circle_manager_can(_circle_id,auth.uid(),'requests') THEN
    RAISE EXCEPTION 'Only Circle managers with join request permission can respond to requests' USING ERRCODE='42501';
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

REVOKE ALL ON FUNCTION public.circle_manager_can(uuid,uuid,text), public.revoke_circle_admin_invite_link(),
  public.get_my_circle_admin_permissions(uuid), public.get_circle_member_invite_code(uuid),
  public.list_circle_admins(uuid), public.update_circle_admin(uuid,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_circle_admin_permissions(uuid), public.get_circle_member_invite_code(uuid),
  public.list_circle_admins(uuid), public.update_circle_admin(uuid,uuid,text,boolean) TO authenticated;
