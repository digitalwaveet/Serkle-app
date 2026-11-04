-- Add post_type column to posts table to distinguish between different media formats
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_type text DEFAULT 'photo';

-- Update existing posts based on their content if possible
UPDATE public.posts 
SET post_type = 'video' 
WHERE media_url LIKE '%.mp4' 
   OR media_url LIKE '%.mov' 
   OR media_url LIKE '%.webm';

-- Ensure new posts have valid types (photo, video, pdf, text)
-- We use a check constraint for safety
ALTER TABLE public.posts ADD CONSTRAINT posts_post_type_check 
CHECK (post_type IN ('photo', 'video', 'pdf', 'text'));

-- Index for performance when filtering by type
CREATE INDEX IF NOT EXISTS posts_post_type_idx ON public.posts(post_type);
