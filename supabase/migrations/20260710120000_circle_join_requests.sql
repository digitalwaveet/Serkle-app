-- Private-circle join requests: approve / decline
-- ---------------------------------------------------------------------------
-- Requesting to join a private circle inserts a circle_members row with
-- status 'pending', but circle_members has no UPDATE policy, so owners could
-- never flip a request to 'active' from the client. This RPC performs the
-- moderation action after verifying the caller manages the circle.
-- The existing member-count trigger handles pending -> active increments.

CREATE OR REPLACE FUNCTION public.respond_circle_join_request(
  _circle_id uuid,
  _user_id uuid,
  _approve boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _can_manage boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.circles c WHERE c.id = _circle_id AND c.creator_id = auth.uid()
    UNION
    SELECT 1 FROM public.circle_members m
    WHERE m.circle_id = _circle_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('creator', 'admin')
  ) INTO _can_manage;

  IF NOT _can_manage THEN
    RAISE EXCEPTION 'Only circle admins can respond to join requests';
  END IF;

  IF _approve THEN
    UPDATE public.circle_members
    SET status = 'active', joined_at = now()
    WHERE circle_id = _circle_id AND user_id = _user_id AND status = 'pending';
  ELSE
    DELETE FROM public.circle_members
    WHERE circle_id = _circle_id AND user_id = _user_id AND status = 'pending';
  END IF;
END;
$$;
