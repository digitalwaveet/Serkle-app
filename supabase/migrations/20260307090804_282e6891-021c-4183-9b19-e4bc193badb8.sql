-- Track mentions in stories for resharing
CREATE TABLE IF NOT EXISTS public.story_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(story_id, mentioned_user_id)
);

ALTER TABLE public.story_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own mentions"
  ON public.story_mentions FOR SELECT
  TO authenticated
  USING (mentioned_user_id = auth.uid() OR story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid()));

CREATE POLICY "Story creators can add mentions"
  ON public.story_mentions FOR INSERT
  TO authenticated
  WITH CHECK (story_id IN (SELECT id FROM public.stories WHERE user_id = auth.uid()));

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reshared_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reshared_story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL;