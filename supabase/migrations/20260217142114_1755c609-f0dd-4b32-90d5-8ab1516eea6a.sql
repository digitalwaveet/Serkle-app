
-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "posts_select_policy" ON public.posts;

-- Create a fixed SELECT policy that allows:
-- 1. Non-circle posts (is_premium is false/null) visible to everyone
-- 2. Circle posts visible to circle members (non-premium)
-- 3. Premium circle posts visible to creator, author, or subscribers
CREATE POLICY "posts_select_policy" ON public.posts
FOR SELECT USING (
  CASE
    -- Non-circle posts: visible if not premium or if author
    WHEN circle_id IS NULL THEN
      (COALESCE(is_premium, false) = false) OR (auth.uid() = user_id)
    -- Circle posts
    ELSE
      -- Author can always see own posts
      (auth.uid() = user_id)
      -- Circle creator can see all posts
      OR (EXISTS (SELECT 1 FROM circles WHERE circles.id = posts.circle_id AND circles.creator_id = auth.uid()))
      -- Non-premium circle posts: any active circle member can see
      OR (
        COALESCE(is_premium, false) = false
        AND is_circle_member(circle_id, auth.uid())
      )
      -- Premium circle posts: only subscribers
      OR (
        COALESCE(is_premium, false) = true
        AND has_circle_subscription(circle_id, auth.uid())
      )
  END
);
