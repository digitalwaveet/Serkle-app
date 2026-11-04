CREATE POLICY "Users can upload group avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-avatars');