
-- Add UPDATE policy for circle_resources so download counts can be incremented by members
CREATE POLICY "Circle members can update resource download counts"
ON public.circle_resources
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM circle_members
    WHERE circle_members.circle_id = circle_resources.circle_id
      AND circle_members.user_id = auth.uid()
      AND circle_members.status = 'active'
  )
);

-- Add download policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Circle members can download resources' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Circle members can download resources" ON storage.objects FOR SELECT USING (bucket_id = ''circle-resources'' AND auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- Add delete policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own resource files' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete own resource files" ON storage.objects FOR DELETE USING (bucket_id = ''circle-resources'' AND auth.uid() IS NOT NULL)';
  END IF;
END $$;
