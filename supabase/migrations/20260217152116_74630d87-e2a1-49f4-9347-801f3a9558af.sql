
-- Add UPDATE policy on story_views so upsert works
CREATE POLICY "Viewers can update own view"
ON public.story_views FOR UPDATE
USING (auth.uid() = viewer_id);

-- Add FK from story_likes.user_id to profiles.id
ALTER TABLE public.story_likes
ADD CONSTRAINT story_likes_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add FKs from story_messages to profiles
ALTER TABLE public.story_messages
ADD CONSTRAINT story_messages_sender_id_fkey
FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.story_messages
ADD CONSTRAINT story_messages_receiver_id_fkey
FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
