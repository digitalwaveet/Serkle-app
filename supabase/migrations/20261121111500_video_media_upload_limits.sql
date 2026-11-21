-- Keep the backend contract aligned with CreateVideo's 100 MB validation.
-- The project-level Storage limit must also be at least 100 MB.
UPDATE storage.buckets
SET file_size_limit = 104857600,
    allowed_mime_types = ARRAY[
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
WHERE id = 'video-media';
