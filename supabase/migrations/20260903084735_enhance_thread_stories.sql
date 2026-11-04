-- Migration to enhance Serkle Thread Stories
-- 1. Add title and media_url to thread_updates
ALTER TABLE public.thread_updates
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- 2. Add UPDATE policy to thread_updates if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'thread_updates' 
    AND policyname = 'Users can update own thread updates'
  ) THEN
    CREATE POLICY "Users can update own thread updates"
    ON public.thread_updates
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Create story_followers table for Following Stories
CREATE TABLE IF NOT EXISTS public.story_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, user_id)
);

ALTER TABLE public.story_followers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'story_followers' 
    AND policyname = 'Anyone can view story followers'
  ) THEN
    CREATE POLICY "Anyone can view story followers"
    ON public.story_followers
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'story_followers' 
    AND policyname = 'Users can follow stories'
  ) THEN
    CREATE POLICY "Users can follow stories"
    ON public.story_followers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'story_followers' 
    AND policyname = 'Users can unfollow stories'
  ) THEN
    CREATE POLICY "Users can unfollow stories"
    ON public.story_followers
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_story_followers_question_id ON public.story_followers(question_id);
CREATE INDEX IF NOT EXISTS idx_story_followers_user_id ON public.story_followers(user_id);

-- Enable Realtime for story_followers if publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_followers;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Notification trigger on new thread update to story followers
CREATE OR REPLACE FUNCTION public.notify_story_followers_on_update()
RETURNS TRIGGER AS $$
DECLARE
  q_author_name TEXT;
  q_title TEXT;
  follower RECORD;
BEGIN
  -- Ensure question is marked as a thread story
  UPDATE public.questions 
  SET is_thread = true, updated_at = now() 
  WHERE id = NEW.question_id;

  -- Determine display name of author for notification
  SELECT 
    CASE 
      WHEN is_anonymous THEN COALESCE(anonymous_name, 'Anonymous')
      ELSE 'The author'
    END,
    SUBSTRING(question FROM 1 FOR 60)
  INTO q_author_name, q_title
  FROM public.questions
  WHERE id = NEW.question_id;

  -- Notify each follower
  FOR follower IN 
    SELECT user_id FROM public.story_followers 
    WHERE question_id = NEW.question_id AND user_id != NEW.user_id
  LOOP
    INSERT INTO public.push_notifications (
      user_id,
      title,
      body,
      data,
      sent_at
    ) VALUES (
      follower.user_id,
      'Story Update: ' || COALESCE(NEW.title, 'New update posted'),
      q_author_name || ' posted an update to: "' || q_title || '..."',
      jsonb_build_object(
        'type', 'story_update',
        'question_id', NEW.question_id,
        'update_id', NEW.id,
        'url', '/ask/question/' || NEW.question_id
      ),
      now()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_story_followers ON public.thread_updates;
CREATE TRIGGER trigger_notify_story_followers
AFTER INSERT ON public.thread_updates
FOR EACH ROW
EXECUTE FUNCTION public.notify_story_followers_on_update();
