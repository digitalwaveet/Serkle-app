
CREATE TABLE public.circle_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitation_type TEXT NOT NULL CHECK (invitation_type IN ('admin', 'transfer_ownership')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

ALTER TABLE public.circle_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invitations"
ON public.circle_invitations FOR SELECT TO authenticated
USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

CREATE POLICY "Authenticated users can create invitations"
ON public.circle_invitations FOR INSERT TO authenticated
WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Invitees can update invitation status"
ON public.circle_invitations FOR UPDATE TO authenticated
USING (invitee_id = auth.uid())
WITH CHECK (invitee_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_invitations;
