-- ============================================================================
-- STORAGE SETUP: CIRCLE VIDEOS BUCKET (ROBUST UUID CHECKS)
-- ============================================================================

-- 0. Ensure the helper function exists
CREATE OR REPLACE FUNCTION public.is_circle_admin(_circle_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members
    WHERE circle_id = _circle_id
      AND user_id = _user_id
      AND role IN ('creator', 'admin')
      AND status = 'active'
  );
$$;

-- 1. Create the circle-videos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('circle-videos', 'circle-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Circle Admins Upload" ON storage.objects;
DROP POLICY IF EXISTS "Circle Admins Update Delete" ON storage.objects;
DROP POLICY IF EXISTS "Circle Admins Manage Videos" ON storage.objects;

-- 3. Allow public/authenticated viewing of videos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'circle-videos' );

-- 4. Allow circle creators and admins to manage videos
-- We use a regex check to ensure the folder name is a valid UUID before casting
CREATE POLICY "Circle Admins Manage Videos"
ON storage.objects FOR ALL
USING (
  bucket_id = 'circle-videos'
  AND (name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/')
  AND (
    public.is_circle_admin((split_part(name, '/', 1))::uuid, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.circles 
      WHERE id = (split_part(name, '/', 1))::uuid 
      AND creator_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'circle-videos'
  AND (name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/')
  AND (
    public.is_circle_admin((split_part(name, '/', 1))::uuid, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.circles 
      WHERE id = (split_part(name, '/', 1))::uuid 
      AND creator_id = auth.uid()
    )
  )
);
