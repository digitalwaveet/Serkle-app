
-- Security definer function to accept circle invitations
-- This bypasses RLS so the invitee can update circle_members roles and circles.creator_id
CREATE OR REPLACE FUNCTION public.accept_circle_invitation(_invitation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invitation RECORD;
BEGIN
  -- Get and validate invitation
  SELECT * INTO _invitation
  FROM public.circle_invitations
  WHERE id = _invitation_id
    AND invitee_id = _user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already responded';
  END IF;

  -- Mark invitation as accepted
  UPDATE public.circle_invitations
  SET status = 'accepted', responded_at = now()
  WHERE id = _invitation_id;

  IF _invitation.invitation_type = 'admin' THEN
    -- Check if already a member
    IF EXISTS (
      SELECT 1 FROM public.circle_members
      WHERE circle_id = _invitation.circle_id AND user_id = _user_id
    ) THEN
      UPDATE public.circle_members
      SET role = 'admin'
      WHERE circle_id = _invitation.circle_id AND user_id = _user_id;
    ELSE
      INSERT INTO public.circle_members (circle_id, user_id, role, status)
      VALUES (_invitation.circle_id, _user_id, 'admin', 'active');
    END IF;

  ELSIF _invitation.invitation_type = 'transfer_ownership' THEN
    -- Transfer ownership: update circle creator_id
    UPDATE public.circles
    SET creator_id = _user_id
    WHERE id = _invitation.circle_id;

    -- Make new owner a creator member
    IF EXISTS (
      SELECT 1 FROM public.circle_members
      WHERE circle_id = _invitation.circle_id AND user_id = _user_id
    ) THEN
      UPDATE public.circle_members
      SET role = 'creator'
      WHERE circle_id = _invitation.circle_id AND user_id = _user_id;
    ELSE
      INSERT INTO public.circle_members (circle_id, user_id, role, status)
      VALUES (_invitation.circle_id, _user_id, 'creator', 'active');
    END IF;

    -- Downgrade old owner to member (don't remove them)
    UPDATE public.circle_members
    SET role = 'member'
    WHERE circle_id = _invitation.circle_id AND user_id = _invitation.inviter_id;
  END IF;

  RETURN true;
END;
$$;

-- Also add an RLS policy for circle_members UPDATE (needed for non-invitation role changes by creators)
CREATE POLICY "Creators and admins can update members"
ON public.circle_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.circles
    WHERE circles.id = circle_members.circle_id
    AND circles.creator_id = auth.uid()
  )
);
