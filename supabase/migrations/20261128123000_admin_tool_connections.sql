CREATE OR REPLACE FUNCTION public.save_admin_moderation_status(_kind text, _content_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _status IS NULL OR _status NOT IN ('active', 'hidden', 'removed', 'flagged') THEN
    RAISE EXCEPTION 'Invalid moderation status' USING ERRCODE = '22023';
  END IF;
  CASE _kind
    WHEN 'post' THEN UPDATE public.posts SET moderation_status = _status WHERE id = _content_id;
    WHEN 'video' THEN UPDATE public.videos SET moderation_status = _status WHERE id = _content_id;
    ELSE RAISE EXCEPTION 'Invalid content type' USING ERRCODE = '22023';
  END CASE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Content no longer exists' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id)
    VALUES (actor, _kind || '_' || _status, _kind, _content_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_post_pin(_post_id uuid, _pinned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _pinned IS NULL THEN RAISE EXCEPTION 'Pin state required' USING ERRCODE = '22023'; END IF;
  UPDATE public.posts SET pinned_at = CASE WHEN _pinned THEN statement_timestamp() ELSE NULL END WHERE id = _post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post no longer exists' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id)
    VALUES (actor, CASE WHEN _pinned THEN 'pin_post' ELSE 'unpin_post' END, 'post', _post_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_admin_profile_status(_user_id uuid, _action text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false)
    OR (_action IN ('ban', 'unban') AND (actor = _user_id OR public.is_any_admin(_user_id))) THEN
    RAISE EXCEPTION 'Profile change is not authorized' USING ERRCODE = '42501';
  END IF;
  IF _action IS NULL OR _action NOT IN ('ban', 'unban', 'verify', 'unverify') OR length(_notes) > 2000 THEN
    RAISE EXCEPTION 'Invalid profile status change' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles p SET
    banned_at = CASE WHEN _action = 'ban' THEN COALESCE(p.banned_at, statement_timestamp()) WHEN _action = 'unban' THEN NULL ELSE p.banned_at END,
    is_verified = CASE WHEN _action = 'verify' THEN true WHEN _action = 'unverify' THEN false ELSE p.is_verified END,
    admin_notes = CASE WHEN _action = 'ban' THEN COALESCE(nullif(btrim(_notes), ''), p.admin_notes) ELSE p.admin_notes END
    WHERE p.id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile no longer exists' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id) VALUES (actor, _action || '_user', 'user', _user_id::text);
END;
$$;

-- The inbox and device delivery share the same records. Only pending device
-- notifications are submitted to the existing delivery worker.
ALTER TABLE public.push_notifications DROP CONSTRAINT IF EXISTS push_notifications_delivery_status_check;
ALTER TABLE public.push_notifications ADD CONSTRAINT push_notifications_delivery_status_check CHECK (
  delivery_status IN ('pending', 'processing', 'delivered', 'failed', 'failed_permanent', 'no_subscription', 'expired', 'in_app_only')
);
DROP TRIGGER IF EXISTS on_push_notification_created ON public.push_notifications;
CREATE TRIGGER on_push_notification_created AFTER INSERT ON public.push_notifications
  FOR EACH ROW WHEN (NEW.delivery_status = 'pending') EXECUTE FUNCTION public.deliver_push_notification();

ALTER TABLE public.admin_broadcasts ADD COLUMN IF NOT EXISTS recipient_count integer;

CREATE OR REPLACE FUNCTION public.send_admin_broadcast(_request_id uuid, _title text, _message text, _audience text, _channel text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid(); prior public.admin_broadcasts%ROWTYPE; recipients integer;
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL OR length(btrim(COALESCE(_title, ''))) NOT BETWEEN 1 AND 120
    OR length(btrim(COALESCE(_message, ''))) NOT BETWEEN 1 AND 2000 OR _audience IS NULL OR _channel IS NULL
    OR _audience NOT IN ('all', 'sellers', 'helpers', 'new_users') OR _channel NOT IN ('in_app', 'push', 'both') THEN
    RAISE EXCEPTION 'Invalid broadcast details' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.admin_broadcasts (id, sender_id, title, message, target_audience, channel, status)
    VALUES (_request_id, actor, btrim(_title), btrim(_message), _audience, _channel, 'draft') ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO prior FROM public.admin_broadcasts WHERE id = _request_id;
    IF prior.sender_id IS DISTINCT FROM actor OR prior.title IS DISTINCT FROM btrim(_title)
      OR prior.message IS DISTINCT FROM btrim(_message) OR prior.target_audience IS DISTINCT FROM _audience
      OR prior.channel IS DISTINCT FROM _channel OR prior.recipient_count IS NULL THEN
      RAISE EXCEPTION 'Broadcast request already used' USING ERRCODE = '55000';
    END IF;
    RETURN prior.recipient_count;
  END IF;

  INSERT INTO public.push_notifications (user_id, notification_type, title, body, data, delivery_status)
    SELECT p.id, 'admin_broadcast', btrim(_title), btrim(_message), jsonb_build_object('broadcast_id', _request_id),
      CASE WHEN _channel = 'in_app' THEN 'in_app_only' ELSE 'pending' END
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.banned_at IS NULL AND (
      _audience = 'all'
      OR (_audience = 'sellers' AND EXISTS(SELECT 1 FROM public.seller_profiles s WHERE s.user_id = p.id))
      OR (_audience = 'helpers' AND EXISTS(SELECT 1 FROM public.helper_profiles h WHERE h.user_id = p.id))
      OR (_audience = 'new_users' AND p.created_at >= statement_timestamp() - interval '7 days')
    );
  GET DIAGNOSTICS recipients = ROW_COUNT;
  UPDATE public.admin_broadcasts SET recipient_count = recipients, status = 'sent', sent_at = statement_timestamp()
    WHERE id = _request_id;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (actor, 'broadcast_queued', 'broadcast', _request_id::text, jsonb_build_object('audience', _audience, 'channel', _channel, 'recipients', recipients));
  RETURN recipients;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_admin_warning(_user_id uuid, _type text, _reason text, _severity text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid(); warning_id uuid;
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _type IS NULL OR _type NOT IN ('warning', 'strike', 'final_warning') OR _severity IS NULL
    OR _severity NOT IN ('low', 'medium', 'high', 'critical') OR length(btrim(COALESCE(_reason, ''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Invalid warning details' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.user_warnings (user_id, issued_by, warning_type, reason, severity)
    VALUES (_user_id, actor, _type, btrim(_reason), _severity) RETURNING id INTO warning_id;
  INSERT INTO public.push_notifications (user_id, notification_type, title, body, data, delivery_status)
    VALUES (_user_id, 'admin_warning', 'Serkle account notice', btrim(_reason), jsonb_build_object('warning_id', warning_id), 'in_app_only');
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (actor, 'warning_issued', 'user', _user_id::text, jsonb_build_object('warning_id', warning_id, 'type', _type, 'severity', _severity));
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_admin_bulk_action(_target text, _action text, _ids uuid[], _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid(); target_id uuid;
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _target IS NULL OR _action IS NULL OR _ids IS NULL OR cardinality(_ids) NOT BETWEEN 1 AND 50
    OR array_position(_ids, NULL::uuid) IS NOT NULL OR length(_reason) > 2000
    OR NOT ((_target = 'users' AND _action IN ('ban', 'unban')) OR (_target = 'posts' AND _action IN ('hide', 'remove', 'restore'))) THEN
    RAISE EXCEPTION 'Invalid bulk action' USING ERRCODE = '22023';
  END IF;
  FOR target_id IN SELECT DISTINCT id FROM unnest(_ids) AS selected(id) ORDER BY id LOOP
    IF _target = 'users' THEN
      PERFORM public.save_admin_profile_status(target_id, _action, _reason);
    ELSE
      PERFORM public.save_admin_moderation_status('post', target_id,
        CASE _action WHEN 'hide' THEN 'hidden' WHEN 'remove' THEN 'removed' ELSE 'active' END);
    END IF;
  END LOOP;
  INSERT INTO public.bulk_action_logs (performed_by, action_type, target_type, target_ids, details)
    VALUES (actor, _action, _target, _ids, jsonb_build_object('reason', nullif(btrim(_reason), '')));
END;
$$;

CREATE OR REPLACE FUNCTION public.record_admin_post_scan(_actor uuid, _post_id uuid, _content text,
  _spam numeric, _hate numeric, _nsfw numeric, _risk text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE post public.posts%ROWTYPE; rule record; result_id uuid; result_status text;
BEGIN
  IF NOT COALESCE(public.is_any_admin(_actor), false) THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  IF _spam IS NULL OR _hate IS NULL OR _nsfw IS NULL OR _risk IS NULL OR _risk NOT IN ('low','medium','high','critical')
     OR _spam NOT BETWEEN 0 AND 1 OR _hate NOT BETWEEN 0 AND 1 OR _nsfw NOT BETWEEN 0 AND 1 THEN
    RAISE EXCEPTION 'Invalid scan result' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO post FROM public.posts WHERE id = _post_id FOR UPDATE;
  IF NOT FOUND OR post.content IS DISTINCT FROM _content THEN RAISE EXCEPTION 'Post changed during scan' USING ERRCODE = '55000'; END IF;

  SELECT r.id, r.action INTO rule FROM public.auto_moderation_rules r
    WHERE r.is_active AND r.action IN ('flag','hide','remove') AND (
      (r.rule_type = 'keyword' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(r.conditions->'keywords') = 'array' THEN r.conditions->'keywords' ELSE '[]'::jsonb END) keyword
        WHERE length(btrim(keyword)) > 0 AND strpos(lower(post.content), lower(btrim(keyword))) > 0
      )) OR (r.rule_type = 'threshold' AND (
        _spam >= CASE WHEN jsonb_typeof(r.conditions->'spam_threshold') = 'number' THEN (r.conditions->>'spam_threshold')::numeric ELSE 2 END
        OR _hate >= CASE WHEN jsonb_typeof(r.conditions->'hate_threshold') = 'number' THEN (r.conditions->>'hate_threshold')::numeric ELSE 2 END
        OR _nsfw >= CASE WHEN jsonb_typeof(r.conditions->'nsfw_threshold') = 'number' THEN (r.conditions->>'nsfw_threshold')::numeric ELSE 2 END
      ))
    ) ORDER BY CASE r.action WHEN 'remove' THEN 1 WHEN 'hide' THEN 2 ELSE 3 END, r.id LIMIT 1;

  result_status := CASE rule.action WHEN 'remove' THEN 'removed' WHEN 'hide' THEN 'hidden' WHEN 'flag' THEN 'flagged' END;
  INSERT INTO public.ai_moderation_results (content_type, content_id, content_text, user_id, spam_score, hate_score, nsfw_score, overall_risk, ai_reasoning, auto_action)
    VALUES ('post', _post_id, left(_content, 1000), post.user_id, _spam, _hate, _nsfw, _risk, left(_reason, 200), result_status)
    RETURNING id INTO result_id;
  IF result_status IS NOT NULL THEN
    UPDATE public.posts SET moderation_status = result_status WHERE id = _post_id AND (
      COALESCE(moderation_status, 'active') IN ('active','flagged') OR (moderation_status = 'hidden' AND result_status = 'removed')
    );
    INSERT INTO public.content_review_queue (content_type, content_id, content_preview, reason, priority)
      SELECT 'post', _post_id, left(_content, 300), 'Matched an automated moderation rule',
        CASE WHEN result_status IN ('hidden','removed') THEN 'high' ELSE 'normal' END
      WHERE NOT EXISTS (SELECT 1 FROM public.content_review_queue WHERE content_type = 'post' AND content_id = _post_id AND status IN ('pending','in_review'));
    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
      VALUES (_actor, 'auto_rule_matched', 'post', _post_id::text, jsonb_build_object('rule_id', rule.id, 'status', result_status));
  END IF;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_admin_post_scan(uuid, uuid, text, numeric, numeric, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_admin_post_scan(uuid, uuid, text, numeric, numeric, numeric, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.review_admin_ai_results(_ids uuid[], _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid(); item public.ai_moderation_results%ROWTYPE; reviewed integer := 0;
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  IF _ids IS NULL OR cardinality(_ids) NOT BETWEEN 1 AND 100 OR _action IS NULL OR _action NOT IN ('approved','hidden','removed') THEN
    RAISE EXCEPTION 'Invalid moderation review' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT * FROM public.ai_moderation_results WHERE id = ANY(_ids) ORDER BY id FOR UPDATE LOOP
    IF item.reviewed_at IS NOT NULL THEN RAISE EXCEPTION 'A scan was already reviewed' USING ERRCODE = '55000'; END IF;
    IF item.content_type = 'post' AND _action IN ('hidden','removed') THEN
      PERFORM public.save_admin_moderation_status('post', item.content_id, _action);
    END IF;
    UPDATE public.ai_moderation_results SET reviewed_by = actor, reviewed_at = statement_timestamp(), review_action = _action WHERE id = item.id;
    reviewed := reviewed + 1;
  END LOOP;
  IF reviewed <> cardinality(_ids) THEN RAISE EXCEPTION 'A scan is no longer available' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, details)
    VALUES (actor, 'ai_review_' || _action, 'moderation', jsonb_build_object('ids', _ids));
END;
$$;
REVOKE ALL ON FUNCTION public.review_admin_ai_results(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_admin_ai_results(uuid[], text) TO authenticated;

REVOKE ALL ON FUNCTION public.save_admin_moderation_status(text, uuid, text), public.set_admin_post_pin(uuid, boolean),
  public.save_admin_profile_status(uuid, text, text), public.send_admin_broadcast(uuid, text, text, text, text),
  public.issue_admin_warning(uuid, text, text, text), public.apply_admin_bulk_action(text, text, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_admin_moderation_status(text, uuid, text), public.set_admin_post_pin(uuid, boolean),
  public.save_admin_profile_status(uuid, text, text), public.send_admin_broadcast(uuid, text, text, text, text),
  public.issue_admin_warning(uuid, text, text, text), public.apply_admin_bulk_action(text, text, uuid[], text) TO authenticated;

NOTIFY pgrst, 'reload schema';
