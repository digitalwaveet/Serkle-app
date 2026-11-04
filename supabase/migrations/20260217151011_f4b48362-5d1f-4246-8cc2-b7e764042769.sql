
-- Create story_likes table
CREATE TABLE public.story_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Enable RLS on story_likes
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

-- Story owner can see who liked their stories
CREATE POLICY "Story owners can view likes on their stories"
ON public.story_likes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stories s WHERE s.id = story_likes.story_id AND s.user_id = auth.uid()
  )
  OR auth.uid() = user_id
);

-- Authenticated users can like stories
CREATE POLICY "Authenticated users can like stories"
ON public.story_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unlike stories
CREATE POLICY "Users can unlike stories"
ON public.story_likes FOR DELETE
USING (auth.uid() = user_id);

-- Create story_messages table
CREATE TABLE public.story_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on story_messages
ALTER TABLE public.story_messages ENABLE ROW LEVEL SECURITY;

-- Sender and receiver can view messages
CREATE POLICY "Users can view their story messages"
ON public.story_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Authenticated users can send story messages
CREATE POLICY "Authenticated users can send story messages"
ON public.story_messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Senders can delete own messages
CREATE POLICY "Users can delete own story messages"
ON public.story_messages FOR DELETE
USING (auth.uid() = sender_id);

-- Enable realtime for all story tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
