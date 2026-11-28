ALTER TABLE public.circle_members
  ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN activity_permissions jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(activity_permissions) = 'object');

CREATE FUNCTION public.circle_permission_feature(_permission text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT CASE _permission
    WHEN 'publish_posts' THEN 'posts' WHEN 'moderate_posts' THEN 'posts'
    WHEN 'videos' THEN 'videos' WHEN 'resources' THEN 'resources'
    WHEN 'events' THEN 'events' WHEN 'services' THEN 'services' WHEN 'messages' THEN 'messages'
  END;
$$;

CREATE OR REPLACE FUNCTION public.circle_manager_can(_circle_id uuid, _user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM circles c LEFT JOIN circle_members m
      ON m.circle_id = c.id AND m.user_id = _user_id AND m.status = 'active' AND m.role = 'admin'
    WHERE c.id = _circle_id
      AND _permission IN ('invite','requests','manage_admins','analytics','settings','publish_posts','moderate_posts','videos','resources','events','services','messages')
      AND (circle_permission_feature(_permission) IS NULL OR circle_permission_feature(_permission) = 'posts'
        OR circle_permission_feature(_permission) = ANY(c.enabled_features))
      AND (c.creator_id = _user_id OR (m.user_id IS NOT NULL AND c.is_active AND (
        m.is_super_admin OR CASE _permission
          WHEN 'invite' THEN m.can_invite_members
          WHEN 'requests' THEN m.can_respond_to_requests
          WHEN 'manage_admins' THEN false
          WHEN 'settings' THEN (m.activity_permissions -> 'settings') = 'true'::jsonb
          ELSE (m.activity_permissions -> _permission) IS DISTINCT FROM 'false'::jsonb
        END
      )))
  );
$$;

-- Policy helper binds the actor to their session and exposes only their own rights.
CREATE FUNCTION public.has_circle_activity_permission(_circle_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT circle_manager_can(_circle_id, auth.uid(), _permission);
$$;

CREATE OR REPLACE FUNCTION public.get_my_circle_admin_permissions(_circle_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'can_invite_members', circle_manager_can(_circle_id, auth.uid(), 'invite'),
    'can_respond_to_requests', circle_manager_can(_circle_id, auth.uid(), 'requests'),
    'is_super_admin', EXISTS (SELECT 1 FROM circle_members WHERE circle_id = _circle_id AND user_id = auth.uid()
      AND role = 'admin' AND status = 'active' AND is_super_admin)
      AND circle_manager_can(_circle_id, auth.uid(), 'manage_admins'),
    'activity_permissions', (SELECT jsonb_object_agg(permission, circle_manager_can(_circle_id, auth.uid(), permission))
      FROM unnest(ARRAY['publish_posts','moderate_posts','videos','resources','events','services','messages','analytics','settings']) AS p(permission))
  );
$$;

CREATE OR REPLACE FUNCTION public.list_circle_admins(_circle_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT circle_manager_can(_circle_id, auth.uid(), 'manage_admins') THEN
    RAISE EXCEPTION 'Admin management permission required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'name', p.name, 'username', p.username,
      'can_invite_members', m.can_invite_members, 'can_respond_to_requests', m.can_respond_to_requests,
      'is_super_admin', m.is_super_admin, 'activity_permissions', m.activity_permissions
    ) ORDER BY p.name, m.user_id)
    FROM circle_members m JOIN profiles p ON p.id = m.user_id JOIN circles c ON c.id = m.circle_id
    WHERE m.circle_id = _circle_id AND m.status = 'active' AND m.role = 'admin' AND m.user_id <> c.creator_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_circle_admin(_circle_id uuid, _user_id uuid, _action text, _allowed boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles; target circle_members; owner_action boolean;
BEGIN
  SELECT * INTO c FROM circles WHERE id = _circle_id FOR UPDATE;
  IF NOT FOUND OR NOT circle_manager_can(_circle_id, auth.uid(), 'manage_admins') THEN
    RAISE EXCEPTION 'Admin management permission required' USING ERRCODE = '42501';
  END IF;
  owner_action := c.creator_id = auth.uid();
  IF _user_id IS NULL OR _user_id = c.creator_id OR _user_id = auth.uid() OR _action IS NULL
      OR _action NOT IN ('remove','invite','requests','super_admin','analytics','settings','publish_posts','moderate_posts','videos','resources','events','services','messages')
      OR (_action <> 'remove' AND _allowed IS NULL) THEN
    RAISE EXCEPTION 'Invalid administrator change';
  END IF;
  SELECT * INTO target FROM circle_members WHERE circle_id = c.id AND user_id = _user_id AND role = 'admin' AND status = 'active';
  IF NOT owner_action AND (_action = 'super_admin' OR target.is_super_admin) THEN
    RAISE EXCEPTION 'Only the owner can change Super Admin access' USING ERRCODE = '42501';
  END IF;
  IF NOT FOUND AND _action <> 'remove' THEN
    RAISE EXCEPTION 'This person is no longer an active Circle admin';
  END IF;
  IF _action = 'remove' AND NOT owner_action AND target.user_id IS NULL THEN RETURN; END IF;
  UPDATE circle_members SET
    role = CASE WHEN _action = 'remove' THEN 'member' ELSE role END,
    can_invite_members = CASE WHEN _action = 'invite' THEN _allowed ELSE can_invite_members END,
    can_respond_to_requests = CASE WHEN _action = 'requests' THEN _allowed ELSE can_respond_to_requests END,
    is_super_admin = CASE WHEN _action = 'super_admin' THEN _allowed ELSE is_super_admin END,
    activity_permissions = CASE WHEN _action IN ('analytics','settings','publish_posts','moderate_posts','videos','resources','events','services','messages')
      THEN jsonb_set(activity_permissions, ARRAY[_action], to_jsonb(_allowed)) ELSE activity_permissions END
    WHERE circle_id = c.id AND user_id = _user_id AND role = 'admin' AND status = 'active';
  IF _action = 'remove' THEN
    UPDATE circle_invitations SET status = 'declined', responded_at = now()
      WHERE circle_id = c.id AND invitee_id = _user_id AND invitation_type = 'admin' AND status = 'pending';
  END IF;
END;
$$;

CREATE FUNCTION public.reset_circle_admin_access()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.status = 'active' AND (NEW.role <> 'admin' OR NEW.status <> 'active') THEN
    NEW.can_invite_members := true;
    NEW.can_respond_to_requests := true;
    NEW.is_super_admin := false;
    NEW.activity_permissions := '{}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reset_circle_admin_access BEFORE UPDATE OF role, status ON circle_members
  FOR EACH ROW EXECUTE FUNCTION public.reset_circle_admin_access();

CREATE OR REPLACE FUNCTION public.revoke_circle_admin_invite_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.status = 'active' THEN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM circle_member_invite_links WHERE circle_id = OLD.circle_id AND issuer_id = OLD.user_id;
    ELSIF NEW.role <> 'admin' OR NEW.status <> 'active' OR NOT (NEW.can_invite_members OR NEW.is_super_admin) THEN
      DELETE FROM circle_member_invite_links WHERE circle_id = OLD.circle_id AND issuer_id = OLD.user_id;
    END IF;
    IF TG_OP = 'DELETE' THEN
      IF OLD.is_super_admin THEN
        UPDATE circle_invitations SET status = 'declined', responded_at = now()
          WHERE circle_id = OLD.circle_id AND inviter_id = OLD.user_id AND invitation_type = 'admin' AND status = 'pending';
      END IF;
    ELSIF OLD.is_super_admin AND NOT NEW.is_super_admin AND NEW.role <> 'creator' THEN
      UPDATE circle_invitations SET status = 'declined', responded_at = now()
        WHERE circle_id = OLD.circle_id AND inviter_id = OLD.user_id AND invitation_type = 'admin' AND status = 'pending';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER revoke_circle_admin_invite_link ON public.circle_members;
CREATE TRIGGER revoke_circle_admin_invite_link
  AFTER UPDATE OF role, status, can_invite_members, is_super_admin OR DELETE ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.revoke_circle_admin_invite_link();

CREATE OR REPLACE FUNCTION public.send_circle_invitation(_circle_id uuid,_invitee_id uuid,_type text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c circles; invitation_id uuid; actor uuid := auth.uid();
BEGIN
  SELECT * INTO c FROM circles WHERE id = _circle_id FOR UPDATE;
  IF NOT FOUND OR actor IS NULL OR NOT (
    c.creator_id = actor OR (_type = 'admin' AND circle_manager_can(c.id, actor, 'manage_admins'))
  ) THEN RAISE EXCEPTION 'Circle invitation permission required' USING ERRCODE = '42501'; END IF;
  IF _type IS NULL OR _type NOT IN ('admin','transfer_ownership') OR _invitee_id IS NULL
    OR _invitee_id IN (actor, c.creator_id) THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
  SELECT id INTO invitation_id FROM circle_invitations WHERE circle_id = c.id AND inviter_id = actor
    AND invitee_id = _invitee_id AND invitation_type = _type AND status = 'pending' ORDER BY created_at LIMIT 1;
  IF invitation_id IS NULL THEN
    INSERT INTO circle_invitations(circle_id,inviter_id,invitee_id,invitation_type)
      VALUES(c.id,actor,_invitee_id,_type) RETURNING id INTO invitation_id;
  END IF;
  RETURN invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_circle_invitation(_invitation_id uuid,_accept boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE i circle_invitations; c circles; actor uuid := auth.uid();
BEGIN
  SELECT * INTO i FROM circle_invitations WHERE id = _invitation_id;
  IF NOT FOUND OR actor IS NULL OR i.invitee_id <> actor THEN
    RAISE EXCEPTION 'Invitation not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM circles WHERE id = i.circle_id FOR UPDATE;
  SELECT * INTO i FROM circle_invitations WHERE id = _invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation is no longer valid'; END IF;
  IF i.status <> 'pending' THEN RETURN i.status = 'accepted'; END IF;
  IF _accept IS DISTINCT FROM true THEN
    UPDATE circle_invitations SET status = 'declined', responded_at = now() WHERE id = i.id;
    RETURN false;
  END IF;
  IF NOT COALESCE(c.is_active,false) OR NOT (c.creator_id = i.inviter_id
    OR (i.invitation_type = 'admin' AND circle_manager_can(c.id, i.inviter_id, 'manage_admins'))) THEN
    RAISE EXCEPTION 'Invitation is no longer valid';
  END IF;
  IF EXISTS (SELECT 1 FROM circle_members WHERE circle_id = c.id AND user_id = actor AND status IN ('banned','removed')) THEN
    RAISE EXCEPTION 'Membership is restricted' USING ERRCODE = '42501';
  END IF;
  IF i.invitation_type = 'transfer_ownership' THEN
    UPDATE circles SET creator_id = actor WHERE id = c.id;
  ELSIF c.creator_id <> actor THEN
    INSERT INTO circle_members(circle_id,user_id,role,status) VALUES(c.id,actor,'admin','active')
      ON CONFLICT(circle_id,user_id) DO UPDATE SET role = 'admin', status = 'active';
  END IF;
  UPDATE circle_invitations SET status = 'accepted', responded_at = now() WHERE id = i.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.has_circle_activity_permission(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_circle_activity_permission(uuid,text) TO authenticated;

CREATE POLICY circle_delegated_settings_update ON public.circles FOR UPDATE TO authenticated
  USING (public.has_circle_activity_permission(id, 'settings'))
  WITH CHECK (public.has_circle_activity_permission(id, 'settings'));

CREATE FUNCTION public.guard_delegated_circle_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE editable text[] := ARRAY[
  'name','description','category','location','is_private','about_text','guidelines','circle_type',
  'enabled_features','target_audience','member_benefits','primary_language','is_online','posting_policy',
  'avatar_url','cover_image_url','subscription_enabled','subscription_price','subscription_method','is_premium','updated_at'
];
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Use the Circle ownership transfer flow' USING ERRCODE = '42501';
    END IF;
    IF OLD.creator_id IS DISTINCT FROM auth.uid() AND
      ((to_jsonb(OLD) - editable) IS DISTINCT FROM (to_jsonb(NEW) - editable)) THEN
      RAISE EXCEPTION 'Only the Circle owner can change protected settings' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_delegated_circle_settings BEFORE UPDATE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.guard_delegated_circle_settings();

CREATE OR REPLACE FUNCTION public.can_post_in_circle(_user uuid, _circle uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT circle_manager_can(_circle, _user, 'publish_posts') OR EXISTS (
    SELECT 1 FROM circles c JOIN circle_members m ON m.circle_id = c.id
    WHERE c.id = _circle AND c.is_active AND c.posting_policy = 'members'
      AND m.user_id = _user AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.set_circle_post_pinned(_post_id uuid, _pinned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_circle uuid;
BEGIN
  SELECT circle_id INTO target_circle FROM posts WHERE id = _post_id;
  PERFORM 1 FROM circles WHERE id = target_circle FOR UPDATE;
  IF NOT circle_manager_can(target_circle, auth.uid(), 'moderate_posts') THEN
    RAISE EXCEPTION 'Feed moderation permission required' USING ERRCODE = '42501';
  END IF;
  UPDATE posts SET pinned_at = CASE WHEN _pinned THEN now() END WHERE id = _post_id AND circle_id = target_circle;
END;
$$;

CREATE FUNCTION public.remove_circle_feed_post(_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_circle uuid;
BEGIN
  SELECT circle_id INTO target_circle FROM posts WHERE id = _post_id;
  PERFORM 1 FROM circles WHERE id = target_circle FOR UPDATE;
  IF NOT circle_manager_can(target_circle, auth.uid(), 'moderate_posts') THEN
    RAISE EXCEPTION 'Feed moderation permission required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM posts WHERE id = _post_id AND circle_id = target_circle;
END;
$$;

-- This helper is used by the existing video and video-storage policies.
CREATE OR REPLACE FUNCTION public.is_circle_admin(_circle_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT circle_manager_can(_circle_id, _user_id, 'videos');
$$;

CREATE FUNCTION public.can_write_circle_resource_object(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN _name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
      THEN circle_manager_can(split_part(_name, '/', 1)::uuid, auth.uid(), 'resources')
    WHEN _name ~ '^event-recordings/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-'
      THEN EXISTS (SELECT 1 FROM circle_events e WHERE e.id = substring(_name FROM 18 FOR 36)::uuid
        AND circle_manager_can(e.circle_id, auth.uid(), 'events'))
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION public.can_write_circle_resource_object(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_circle_resource_object(text) TO authenticated;
CREATE POLICY circle_activity_resource_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'circle-resources' OR public.can_write_circle_resource_object(name));
CREATE POLICY circle_activity_resource_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'circle-resources' OR public.can_write_circle_resource_object(name))
  WITH CHECK (bucket_id <> 'circle-resources' OR public.can_write_circle_resource_object(name));
CREATE POLICY circle_activity_resource_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'circle-resources' OR public.can_write_circle_resource_object(name));

-- Scoped content writes cannot be used to move an item to another Circle
-- or change the account credited by the existing purchase flows.
CREATE FUNCTION public.keep_circle_content_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.circle_id IS DISTINCT FROM OLD.circle_id OR
    (to_jsonb(NEW) -> TG_ARGV[0]) IS DISTINCT FROM (to_jsonb(OLD) -> TG_ARGV[0]) THEN
    RAISE EXCEPTION 'Circle and content owner cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE resource record;
BEGIN
  FOR resource IN SELECT * FROM (VALUES
    ('circle_videos','videos','user_id'),
    ('video_playlists','videos','user_id'),
    ('circle_events','events','creator_id'),
    ('circle_resources','resources','uploader_id'),
    ('circle_services','services','provider_id')
  ) AS r(table_name, permission, identity_column)
  LOOP
    EXECUTE format('CREATE POLICY circle_activity_insert_guard ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (%I = auth.uid() AND public.has_circle_activity_permission(circle_id, %L))',
      resource.table_name, resource.identity_column, resource.permission);
    EXECUTE format('CREATE POLICY circle_activity_insert ON public.%I FOR INSERT TO authenticated
      WITH CHECK (%I = auth.uid() AND public.has_circle_activity_permission(circle_id, %L))',
      resource.table_name, resource.identity_column, resource.permission);
    EXECUTE format('CREATE POLICY circle_activity_delete_guard ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
      USING (public.has_circle_activity_permission(circle_id, %L))', resource.table_name, resource.permission);
    IF resource.table_name <> 'circle_resources' THEN
      EXECUTE format('CREATE POLICY circle_activity_update_guard ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
        USING (public.has_circle_activity_permission(circle_id, %L))
        WITH CHECK (public.has_circle_activity_permission(circle_id, %L))',
        resource.table_name, resource.permission, resource.permission);
      EXECUTE format('CREATE POLICY circle_activity_update ON public.%I FOR UPDATE TO authenticated
        USING (public.has_circle_activity_permission(circle_id, %L))
        WITH CHECK (public.has_circle_activity_permission(circle_id, %L))',
        resource.table_name, resource.permission, resource.permission);
    END IF;
    EXECUTE format('CREATE TRIGGER keep_circle_content_identity BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.keep_circle_content_identity(%L)',
      resource.table_name, resource.identity_column);
  END LOOP;
END;
$$;

-- Replace broad resource UPDATE access with a counter-only action for readers.
DROP POLICY IF EXISTS "Circle members can update resource download counts" ON public.circle_resources;
CREATE FUNCTION public.record_circle_resource_download(_resource_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE circle_resources SET downloads_count = COALESCE(downloads_count, 0) + 1
  WHERE id = _resource_id AND auth.uid() IS NOT NULL AND circle_content_access('resource', id, auth.uid());
$$;

-- Moderators see the same event data as a host, without changing purchase or wallet rights.
CREATE OR REPLACE FUNCTION public.can_access_circle_event(_id uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM circle_events e WHERE e.id = _id AND (
    e.creator_id = _user OR circle_manager_can(e.circle_id, _user, 'events')
    OR (COALESCE(e.price,0) = 0 AND can_browse_circle(e.circle_id,_user))
    OR EXISTS(SELECT 1 FROM circle_event_attendees a WHERE a.event_id = e.id AND a.user_id = _user AND a.payment_status = 'paid')
  ));
$$;

CREATE POLICY circle_service_manager_booking_read ON public.circle_service_bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.circle_services s WHERE s.id = service_id
    AND public.has_circle_activity_permission(s.circle_id, 'services')));

CREATE FUNCTION public.update_circle_service_booking_status(_booking_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_circle uuid; booking circle_service_bookings;
BEGIN
  SELECT s.circle_id INTO target_circle FROM circle_service_bookings b JOIN circle_services s ON s.id = b.service_id WHERE b.id = _booking_id;
  PERFORM 1 FROM circles WHERE id = target_circle FOR UPDATE;
  IF NOT circle_manager_can(target_circle, auth.uid(), 'services') THEN
    RAISE EXCEPTION 'Services permission required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO booking FROM circle_service_bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND OR _status IS NULL THEN RAISE EXCEPTION 'Booking unavailable'; END IF;
  IF booking.status = _status THEN RETURN; END IF;
  IF NOT ((booking.status = 'pending' AND _status = 'confirmed')
    OR (booking.status = 'confirmed' AND _status = 'completed')
    OR (booking.status = 'pending' AND _status = 'cancelled' AND booking.payment_status IS DISTINCT FROM 'paid')) THEN
    RAISE EXCEPTION 'This booking status change is unavailable';
  END IF;
  UPDATE circle_service_bookings SET status = _status WHERE id = _booking_id;
END;
$$;

-- Member chat still follows its existing read policy. Inbox-only access
-- and management now depend on the configured activity permission.
DROP POLICY IF EXISTS "Circle owner can view all messages" ON public.circle_messages;
CREATE POLICY "Circle owner can view all messages" ON public.circle_messages FOR SELECT TO authenticated
  USING (public.has_circle_activity_permission(circle_id, 'messages'));
DROP POLICY IF EXISTS "Circle owner can update messages" ON public.circle_messages;
REVOKE UPDATE ON public.circle_messages FROM authenticated, anon;
CREATE FUNCTION public.mark_circle_messages_read(_circle_id uuid, _message_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM circles WHERE id = _circle_id FOR UPDATE;
  IF NOT circle_manager_can(_circle_id, auth.uid(), 'messages') THEN
    RAISE EXCEPTION 'Circle messages permission required' USING ERRCODE = '42501';
  END IF;
  UPDATE circle_messages SET is_read = true WHERE circle_id = _circle_id AND id = ANY(_message_ids);
END;
$$;

CREATE FUNCTION public.get_circle_dashboard_totals(_circle_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT circle_manager_can(_circle_id, auth.uid(), 'analytics') THEN
    RAISE EXCEPTION 'Circle analytics permission required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'subscriber_count', (SELECT count(*) FROM circle_subscriptions s
      WHERE s.circle_id = _circle_id AND s.status = 'active' AND s.expires_at > now() AND s.refunded_at IS NULL),
    'tips_total', (SELECT COALESCE(sum(t.amount), 0) FROM circle_tips t JOIN posts p ON p.id = t.post_id
      WHERE p.circle_id = _circle_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_circle_feed_post(uuid), public.record_circle_resource_download(uuid),
  public.update_circle_service_booking_status(uuid,text), public.mark_circle_messages_read(uuid,uuid[]),
  public.get_circle_dashboard_totals(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_circle_feed_post(uuid), public.record_circle_resource_download(uuid),
  public.update_circle_service_booking_status(uuid,text), public.mark_circle_messages_read(uuid,uuid[]),
  public.get_circle_dashboard_totals(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
