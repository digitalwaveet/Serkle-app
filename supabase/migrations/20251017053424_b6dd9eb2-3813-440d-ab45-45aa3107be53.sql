-- Drop ALL existing policies on posts table to start fresh
DROP POLICY IF EXISTS "Posts viewable with proper access" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Free posts viewable by everyone" ON public.posts;

-- Create fresh INSERT policy - allow any authenticated user to create posts
CREATE POLICY "posts_insert_policy"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create fresh SELECT policy with premium access control
CREATE POLICY "posts_select_policy"
ON public.posts
FOR SELECT
TO authenticated
USING (
  -- Non-premium posts are visible to everyone
  NOT is_premium
  OR
  -- Post author can always see their own posts
  auth.uid() = user_id
  OR
  -- For circle posts: circle creator or active subscriber can view
  (
    circle_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.circles
        WHERE id = posts.circle_id
        AND creator_id = auth.uid()
      )
      OR
      public.has_circle_subscription(circle_id, auth.uid())
    )
  )
);

-- Create fresh UPDATE policy
CREATE POLICY "posts_update_policy"
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create fresh DELETE policy
CREATE POLICY "posts_delete_policy"
ON public.posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);