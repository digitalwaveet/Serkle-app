-- Create storage bucket for shop item images (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-item-images', 'shop-item-images', true);

-- Create storage bucket for review images (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-images', 'review-images', true);

-- Create storage bucket for seller assets (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-assets', 'seller-assets', true);

-- RLS Policies for shop-item-images bucket
CREATE POLICY "Anyone can view shop item images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-item-images');

CREATE POLICY "Authenticated users can upload shop item images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shop-item-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own shop item images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'shop-item-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own shop item images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shop-item-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS Policies for review-images bucket
CREATE POLICY "Anyone can view review images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-images');

CREATE POLICY "Authenticated users can upload review images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'review-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own review images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'review-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS Policies for seller-assets bucket
CREATE POLICY "Anyone can view seller assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'seller-assets');

CREATE POLICY "Authenticated users can upload seller assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seller-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own seller assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'seller-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own seller assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'seller-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );