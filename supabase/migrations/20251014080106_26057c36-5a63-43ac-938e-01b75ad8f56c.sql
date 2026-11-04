-- Ensure avatars bucket exists and is public (idempotent upsert pattern)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- Drop existing policies on storage.objects for avatars bucket to avoid duplicates
-- Note: Dropping by name if exists; ignore errors for non-existent policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Avatar images are publicly readable'
  ) THEN
    EXECUTE 'DROP POLICY "Avatar images are publicly readable" ON storage.objects';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload avatar files'
  ) THEN
    EXECUTE 'DROP POLICY "Users can upload avatar files" ON storage.objects';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own avatar files'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update own avatar files" ON storage.objects';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own avatar files'
  ) THEN
    EXECUTE 'DROP POLICY "Users can delete own avatar files" ON storage.objects';
  END IF;
END $$;

-- Create policies for avatars bucket
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Allow authenticated users to upload into avatars bucket; path must start with their user id folder
create policy "Users can upload avatar files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and owner = auth.uid()
    and (position(auth.uid()::text || '/' in name) = 1)
  );

-- Allow users to update their own files in avatars bucket
create policy "Users can update own avatar files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars' and owner = auth.uid()
  )
  with check (
    bucket_id = 'avatars' and owner = auth.uid()
  );

-- Allow users to delete their own files in avatars bucket
create policy "Users can delete own avatar files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars' and owner = auth.uid()
  );