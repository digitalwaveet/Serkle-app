-- Create storage bucket for SOS photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sos-photos',
  'sos-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for sos-photos bucket

-- Allow authenticated users to upload their own SOS photos
CREATE POLICY "Users can upload SOS photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sos-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to SOS photos (for helpers to see)
CREATE POLICY "SOS photos are publicly viewable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'sos-photos');

-- Allow users to delete their own SOS photos
CREATE POLICY "Users can delete their own SOS photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sos-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own SOS photos
CREATE POLICY "Users can update their own SOS photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'sos-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);