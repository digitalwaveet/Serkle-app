
-- Add pinned_message_id to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- Allow conversation members to update pinned message
CREATE POLICY "Members can update conversation pin"
  ON public.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  );
