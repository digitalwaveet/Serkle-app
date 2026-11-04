
-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "posts_select_policy" ON public.posts;

-- Create a fixed SELECT policy that allows:
-- 1. Non-circle posts (is_premium is false/null) visible to everyone
-- 2. ALL circle posts visible to active circle members (premium ones show locked in UI)
-- 3. Circle creator and post author can always see all posts
CREATE POLICY "posts_select_policy" ON public.posts
FOR SELECT USING (
  CASE
    -- Non-circle posts: visible if not premium or if author
    WHEN circle_id IS NULL THEN
      (COALESCE(is_premium, false) = false) OR (auth.uid() = user_id)
    -- Circle posts: any active member can see all posts (premium shown as locked in UI)
    ELSE
      (auth.uid() = user_id)
      OR (EXISTS (SELECT 1 FROM circles WHERE circles.id = posts.circle_id AND circles.creator_id = auth.uid()))
      OR is_circle_member(circle_id, auth.uid())
  END
);
