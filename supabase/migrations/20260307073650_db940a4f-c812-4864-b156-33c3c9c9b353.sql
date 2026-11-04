
-- Add reply, edit, forward, and delete columns to messages table
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forwarded_from_name text,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false;

-- Create message_reactions table
CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Create per-user message deletion tracking
CREATE TABLE public.message_deletions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

-- RLS for message_reactions
CREATE POLICY "Users can view reactions in their conversations"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for message_deletions
CREATE POLICY "Users can view own deletions"
  ON public.message_deletions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own deletions"
  ON public.message_deletions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow message senders to update their own messages (for edit and delete-for-everyone)
CREATE POLICY "Senders can update own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
