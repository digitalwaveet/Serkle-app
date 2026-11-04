-- Fix RLS issues for storage uploads and circle_members policy recursion

-- 1) Storage policies for required buckets
DROP POLICY IF EXISTS "Users can upload post media" ON storage.objects;
CREATE POLICY "Users can upload post media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-media'
);

DROP POLICY IF EXISTS "Users can upload circle avatars" ON storage.objects;
CREATE POLICY "Users can upload circle avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'circle-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload circle covers" ON storage.objects;
CREATE POLICY "Users can upload circle covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'circle-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2) Replace recursive circle_members SELECT policy with function-based
DROP POLICY IF EXISTS "Members viewable by circle members" ON public.circle_members;
DROP POLICY IF EXISTS "Members viewable by members or public circles" ON public.circle_members;
CREATE POLICY "Members viewable by members or public circles"
ON public.circle_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.circles
    WHERE circles.id = circle_members.circle_id
      AND NOT circles.is_private
  )
  OR public.is_circle_member(circle_members.circle_id, auth.uid())
);
