-- Fix posts RLS policy to allow circle posts and ensure proper access
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Free posts viewable by everyone" ON public.posts;

-- Create new insert policy for posts
CREATE POLICY "Users can create posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create new select policy for posts with proper premium access control
CREATE POLICY "Posts viewable with proper access"
ON public.posts
FOR SELECT
TO authenticated
USING (
  -- Non-premium posts are always visible
  (NOT is_premium)
  OR
  -- User is the post author
  (auth.uid() = user_id)
  OR
  -- For circle posts, check if user has subscription or is circle creator
  (
    circle_id IS NOT NULL
    AND (
      -- User is the circle creator
      EXISTS (
        SELECT 1 FROM public.circles
        WHERE circles.id = posts.circle_id
        AND circles.creator_id = auth.uid()
      )
      OR
      -- User has active subscription to the circle
      public.has_circle_subscription(circle_id, auth.uid())
    )
  )
);