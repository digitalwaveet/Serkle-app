CREATE OR REPLACE FUNCTION public.get_admin_operational_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  checked_at timestamptz := statement_timestamp();
  utc_today date := (checked_at AT TIME ZONE 'UTC')::date;
BEGIN
  IF NOT COALESCE(public.is_any_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'checked_at', checked_at,
    'counts', jsonb_build_object(
      'profiles', (SELECT count(*) FROM public.profiles),
      'banned_profiles', (SELECT count(*) FROM public.profiles WHERE banned_at IS NOT NULL),
      'posts', (SELECT count(*) FROM public.posts),
      'videos', (SELECT count(*) FROM public.videos),
      'stories', (SELECT count(*) FROM public.stories),
      'comments', (SELECT count(*) FROM public.comments),
      'messages', (SELECT count(*) FROM public.messages),
      'circles', (SELECT count(*) FROM public.circles),
      'questions', (SELECT count(*) FROM public.questions),
      'orders', (SELECT count(*) FROM public.orders),
      'live_streams', (SELECT count(*) FROM public.live_streams WHERE status = 'live'),
      'pending_reports', (SELECT count(*) FROM public.content_reports WHERE status = 'pending'),
      'pending_appeals', (SELECT count(*) FROM public.appeals WHERE status = 'pending'),
      'pending_reviews', (SELECT count(*) FROM public.content_review_queue WHERE status = 'pending'),
      'open_disputes', (SELECT count(*) FROM public.disputes WHERE status = 'open'),
      'active_sos', (SELECT count(*) FROM public.sos_alerts WHERE status IN ('active', 'responding'))
    ),
    'signups', (
      SELECT jsonb_agg(jsonb_build_object('day', days.day, 'count', coalesce(signups.total, 0)) ORDER BY days.day)
      FROM (SELECT utc_today - n AS day FROM generate_series(0, 6) AS series(n)) AS days
      LEFT JOIN (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*) AS total
        FROM public.profiles
        WHERE created_at >= ((utc_today - 6)::timestamp AT TIME ZONE 'UTC')
          AND created_at <= checked_at
        GROUP BY 1
      ) AS signups USING (day)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_operational_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_operational_snapshot() TO authenticated;

ALTER POLICY "Admins can insert audit log" ON public.admin_audit_log
  WITH CHECK (admin_id = auth.uid() AND public.is_any_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.resolve_admin_content_review(
  _item_id uuid,
  _action text,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  item public.content_review_queue%ROWTYPE;
BEGIN
  IF NOT COALESCE(public.is_any_admin(actor_id), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF _action IS NULL OR _action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid review decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO item FROM public.content_review_queue WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND OR item.status NOT IN ('pending', 'in_review') THEN
    RAISE EXCEPTION 'This review is no longer open' USING ERRCODE = '55000';
  END IF;

  IF item.content_type = 'post' THEN
    UPDATE public.posts
      SET moderation_status = CASE _action WHEN 'approve' THEN 'active' ELSE 'removed' END
      WHERE id = item.content_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The post no longer exists' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  UPDATE public.content_review_queue
    SET status = CASE _action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,
        resolved_by = actor_id,
        resolution_notes = nullif(btrim(_notes), ''),
        resolved_at = statement_timestamp()
    WHERE id = _item_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (actor_id, 'queue_' || _action, item.content_type, item.content_id::text,
      jsonb_build_object('review_id', item.id));
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_admin_content_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_admin_content_review(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
