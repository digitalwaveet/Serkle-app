-- Add media_urls column to support multiple images per post
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrate existing single media_url to media_urls array for backward compatibility
UPDATE posts 
SET media_urls = ARRAY[media_url] 
WHERE media_url IS NOT NULL 
  AND media_url != '' 
  AND (media_urls IS NULL OR array_length(media_urls, 1) IS NULL);