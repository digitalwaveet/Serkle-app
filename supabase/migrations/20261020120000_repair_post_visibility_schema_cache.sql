-- Keep the post composer compatible with databases where the original
-- friends-only visibility migration was missed or PostgREST's schema cache
-- did not refresh after it was applied.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_visibility_check'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_visibility_check
      CHECK (visibility IN ('public', 'friends'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility);

NOTIFY pgrst, 'reload schema';
