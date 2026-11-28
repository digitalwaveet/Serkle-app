-- Aggregate existing wallet data for financial support without exposing payer,
-- payout destination, checkout URL, raw provider responses, or a write API.
CREATE OR REPLACE FUNCTION public.get_admin_wallet_operations(
  _mode text,
  _status text DEFAULT 'all',
  _reference text DEFAULT NULL,
  _before_created_at timestamptz DEFAULT NULL,
  _before_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  checked_at timestamptz := statement_timestamp();
  reference text := nullif(btrim(_reference), '');
BEGIN
  IF NOT COALESCE(public.has_role(auth.uid(), 'super_admin'), false) THEN
    RAISE EXCEPTION 'Super admin access required' USING ERRCODE = '42501';
  END IF;
  IF _mode IS NULL OR _mode NOT IN ('live', 'test') OR _status IS NULL
     OR _status NOT IN ('all', 'pending', 'failed', 'succeeded', 'refunded', 'reversed')
     OR length(reference) > 160 OR (_before_created_at IS NULL) <> (_before_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid payment filters' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'checked_at', checked_at,
    'summary', (SELECT jsonb_build_object(
      'pending', count(*) FILTER (WHERE p.status = 'pending'),
      'failed', count(*) FILTER (WHERE p.status = 'failed'),
      'due', count(*) FILTER (WHERE p.status IN ('pending', 'failed')
        AND p.next_check_at <= checked_at AND p.reversed_at IS NULL
        AND (p.check_lease_until IS NULL OR p.check_lease_until <= checked_at)
        AND (p.checkout_lease_until IS NULL OR p.checkout_lease_until <= checked_at))
    ) FROM public.chapa_payment_intents p WHERE p.mode = _mode),
    'latest_run', (SELECT jsonb_build_object('started_at', r.started_at, 'completed_at', r.completed_at,
      'checked', r.checked, 'errors', r.errors)
      FROM public.wallet_reconciliation_runs r WHERE r.mode = _mode ORDER BY r.started_at DESC, r.id DESC LIMIT 1),
    'items', (SELECT COALESCE(jsonb_agg(to_jsonb(result) ORDER BY result.created_at DESC, result.id DESC), '[]'::jsonb)
      FROM (
        SELECT p.id, p.tx_ref, p.kind, p.amount, p.currency, p.status, p.created_at, p.verified_at,
          p.credited_at, p.reversed_at, p.reserved_at, p.restored_at, p.submitted_at,
          p.next_check_at, p.attempts, (p.last_error IS NOT NULL) AS has_check_error
        FROM public.chapa_payment_intents p
        WHERE p.mode = _mode AND (_status = 'all' OR p.status = _status)
          AND (reference IS NULL OR p.tx_ref = reference)
          AND (_before_created_at IS NULL OR (p.created_at, p.id) < (_before_created_at, _before_id))
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 26
      ) result)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_admin_report(_report_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  target_type text;
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _status IS NULL OR _status NOT IN ('resolved', 'dismissed') OR length(_notes) > 2000 THEN
    RAISE EXCEPTION 'Invalid report decision' USING ERRCODE = '22023';
  END IF;

  UPDATE public.content_reports SET status = _status, reviewed_by = actor,
    reviewed_at = statement_timestamp(), resolution_notes = nullif(btrim(_notes), '')
    WHERE id = _report_id AND status IN ('pending', 'reviewed')
    RETURNING content_type INTO target_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report is no longer open' USING ERRCODE = '55000'; END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (actor, 'report_' || _status, 'content_report', _report_id::text,
      jsonb_build_object('content_type', target_type));
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_admin_ask_content(_kind text, _content_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  CASE _kind
    WHEN 'question' THEN DELETE FROM public.questions WHERE id = _content_id;
    WHEN 'answer' THEN DELETE FROM public.answers WHERE id = _content_id;
    ELSE RAISE EXCEPTION 'Invalid Ask content type' USING ERRCODE = '22023';
  END CASE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ask content no longer exists' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id)
    VALUES (actor, _kind || '_deleted', _kind, _content_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_circle_activity(_circle_id uuid, _active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _active IS NULL THEN RAISE EXCEPTION 'Invalid Circle status' USING ERRCODE = '22023'; END IF;
  UPDATE public.circles SET is_active = _active WHERE id = _circle_id AND is_active IS DISTINCT FROM _active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Circle status already changed or Circle is unavailable' USING ERRCODE = '55000'; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id)
    VALUES (actor, CASE WHEN _active THEN 'circle_reactivated' ELSE 'circle_deactivated' END, 'circle', _circle_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_circles(_search text DEFAULT NULL, _category text DEFAULT NULL, _offset integer DEFAULT 0)
RETURNS TABLE (id uuid, name text, description text, category text, is_private boolean, is_premium boolean,
  is_active boolean, subscription_enabled boolean, subscription_price numeric,
  members_count integer, posts_count integer, events_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT COALESCE(public.is_any_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _offset IS NULL OR _offset < 0 OR length(_search) > 100 OR length(_category) > 80 THEN
    RAISE EXCEPTION 'Invalid Circle filters' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT c.id, c.name::text, c.description::text, c.category::text, c.is_private, c.is_premium,
    c.is_active, c.subscription_enabled, c.subscription_price::numeric,
    s.members_count::integer, s.posts_count::integer, s.events_count::integer
  FROM public.circles c LEFT JOIN public.circle_stats s ON s.circle_id = c.id
  WHERE (nullif(btrim(_search), '') IS NULL OR c.name ILIKE '%' || btrim(_search) || '%')
    AND (_category IS NULL OR c.category = _category OR (_category = 'General' AND c.category = 'Community'))
  ORDER BY c.created_at DESC NULLS LAST, c.id LIMIT 26 OFFSET _offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_circle_members(_circle_id uuid, _offset integer DEFAULT 0)
RETURNS TABLE (id uuid, user_id uuid, role text, status text, joined_at timestamptz, is_owner boolean, name text, username text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT COALESCE(public.is_any_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _offset IS NULL OR _offset < 0 THEN RAISE EXCEPTION 'Invalid member page' USING ERRCODE = '22023'; END IF;
  RETURN QUERY SELECT m.id, m.user_id, m.role::text, m.status::text, m.joined_at,
    m.user_id = c.creator_id, p.name::text, p.username::text
  FROM public.circle_members m JOIN public.circles c ON c.id = m.circle_id
  LEFT JOIN public.profiles p ON p.id = m.user_id WHERE m.circle_id = _circle_id
  ORDER BY (m.user_id = c.creator_id) DESC, m.joined_at DESC NULLS LAST, m.id LIMIT 26 OFFSET _offset;
END;
$$;

-- Keep the established member removal endpoint and lock ownership before removing.
CREATE OR REPLACE FUNCTION public.remove_circle_member(_circle_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  owner_id uuid;
  membership_id uuid;
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT c.creator_id INTO owner_id FROM public.circles c WHERE c.id = _circle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Circle is unavailable' USING ERRCODE = 'P0002'; END IF;
  IF owner_id = _user_id THEN RAISE EXCEPTION 'The Circle owner cannot be removed' USING ERRCODE = '42501'; END IF;

  UPDATE public.circle_members SET status = 'removed'
    WHERE circle_id = _circle_id AND user_id = _user_id AND status = 'active' RETURNING id INTO membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership is no longer active' USING ERRCODE = '55000'; END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (actor, 'member_removed', 'circle_member', membership_id::text, jsonb_build_object('circle_id', _circle_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.review_admin_expert_request(
  _request_id uuid, _status text, _expected_updated_at timestamptz, _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _status IS NULL OR _status NOT IN ('under_review', 'verified', 'rejected', 'more_information_required', 'suspended')
     OR _expected_updated_at IS NULL OR length(_notes) > 4000
     OR (_status IN ('more_information_required', 'suspended') AND nullif(btrim(_notes), '') IS NULL) THEN
    RAISE EXCEPTION 'Invalid expert verification decision' USING ERRCODE = '22023';
  END IF;

  -- The existing expert verification trigger synchronizes the public expert profile.
  UPDATE public.expert_verification_requests e SET status = _status,
    updated_at = statement_timestamp(), reviewed_at = statement_timestamp(), reviewed_by = actor,
    admin_notes = nullif(btrim(_notes), '')
    WHERE e.id = _request_id AND e.updated_at = _expected_updated_at AND e.status <> _status;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification request already changed or is unavailable' USING ERRCODE = '55000'; END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (actor, 'expert_verification', 'expert_verification_request', _request_id::text, jsonb_build_object('status', _status));
END;
$$;

DROP POLICY IF EXISTS "Admins can view all credentials" ON storage.objects;
CREATE POLICY "Admins can view all credentials" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expert_credentials' AND public.is_any_admin(auth.uid()));

REVOKE ALL ON FUNCTION public.get_admin_wallet_operations(text, text, text, timestamptz, uuid),
  public.resolve_admin_report(uuid, text, text), public.delete_admin_ask_content(text, uuid),
  public.set_admin_circle_activity(uuid, boolean), public.list_admin_circles(text, text, integer),
  public.list_admin_circle_members(uuid, integer), public.remove_circle_member(uuid, uuid),
  public.review_admin_expert_request(uuid, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_wallet_operations(text, text, text, timestamptz, uuid),
  public.resolve_admin_report(uuid, text, text), public.delete_admin_ask_content(text, uuid),
  public.set_admin_circle_activity(uuid, boolean), public.list_admin_circles(text, text, integer),
  public.list_admin_circle_members(uuid, integer), public.remove_circle_member(uuid, uuid),
  public.review_admin_expert_request(uuid, text, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
