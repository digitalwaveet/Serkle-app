
-- Circle messages table for member-to-owner private messaging within circles
CREATE TABLE public.circle_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.circle_messages ENABLE ROW LEVEL SECURITY;

-- Members can insert messages to circles they belong to
CREATE POLICY "Circle members can send messages"
ON public.circle_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_circle_member(circle_id, auth.uid())
);

-- Sender can see their own messages
CREATE POLICY "Sender can view own messages"
ON public.circle_messages FOR SELECT
TO authenticated
USING (sender_id = auth.uid());

-- Circle owner/admin can see all messages in their circle
CREATE POLICY "Circle owner can view all messages"
ON public.circle_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.circle_members cm
    WHERE cm.circle_id = circle_messages.circle_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('creator', 'admin')
  )
);

-- Circle owner can update messages (mark as read)
CREATE POLICY "Circle owner can update messages"
ON public.circle_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.circle_members cm
    WHERE cm.circle_id = circle_messages.circle_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('creator', 'admin')
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_messages;

-- Index for fast lookups
CREATE INDEX idx_circle_messages_circle_id ON public.circle_messages(circle_id, created_at DESC);
CREATE INDEX idx_circle_messages_sender_id ON public.circle_messages(sender_id, circle_id);
