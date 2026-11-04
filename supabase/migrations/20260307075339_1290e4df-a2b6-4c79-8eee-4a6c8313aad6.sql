-- Fix recursive RLS policy causing pin load/update failures (42P17)
-- The old policy queried conversation_members from conversation_members policy itself.

DROP POLICY IF EXISTS "Users can view conversation members for their conversations"
ON public.conversation_members;

CREATE POLICY "Users can view conversation members for their conversations"
ON public.conversation_members
FOR SELECT
USING (public.is_conversation_member(conversation_id, auth.uid()));