-- A leave request targets auth.uid() only. Retain its ID across lost responses,
-- so retrying after a later rejoin cannot remove the new membership.
CREATE TABLE public.circle_leave_intents (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, request_id)
);
ALTER TABLE public.circle_leave_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_leave_intents FROM PUBLIC, anon, authenticated;

DROP FUNCTION public.leave_circle(uuid);
CREATE FUNCTION public.leave_circle(_circle_id uuid, _request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  c circles; u uuid := auth.uid(); prior uuid; changed boolean := false;
  replayed boolean := false; snapshot jsonb; member_count integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Please log in' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM circles WHERE id=_circle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Circle unavailable'; END IF;
  IF c.creator_id=u THEN
    RAISE EXCEPTION 'Transfer ownership and wait for acceptance before leaving, or explicitly delete your Circle' USING ERRCODE='42501';
  END IF;
  IF _request_id IS NOT NULL THEN
    SELECT circle_id INTO prior FROM circle_leave_intents WHERE user_id=u AND request_id=_request_id;
    IF FOUND THEN
      IF prior<>c.id THEN RAISE EXCEPTION 'Request ID belongs to another Circle'; END IF;
      replayed := true;
    END IF;
  END IF;
  IF NOT replayed THEN
    UPDATE circle_members SET status='left',role='member'
      WHERE circle_id=c.id AND user_id=u AND status IN ('active','pending');
    changed := FOUND;
    IF _request_id IS NOT NULL THEN
      INSERT INTO circle_leave_intents(user_id,request_id,circle_id) VALUES(u,_request_id,c.id);
    END IF;
  END IF;
  snapshot := get_circle_membership_state(c.id);
  SELECT s.members_count INTO member_count FROM circle_stats s WHERE s.circle_id=c.id;
  IF member_count IS NULL THEN SELECT count(*)::integer INTO member_count FROM circle_members WHERE circle_id=c.id AND status='active'; END IF;
  -- Subscriptions, payment records, renewal settings and unlocks are untouched.
  RETURN snapshot || jsonb_build_object('membership_changed',changed,'replayed',replayed,
    'leave_confirmed',COALESCE(snapshot->>'status'='left',false),'members_count',member_count,
    'circle_visible',NOT COALESCE(c.is_private,false) OR has_circle_subscription(c.id,u));
END;
$$;
REVOKE ALL ON FUNCTION public.leave_circle(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.leave_circle(uuid,uuid) TO authenticated;
