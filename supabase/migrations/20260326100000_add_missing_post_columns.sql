-- Add missing columns to public.posts table
-- These columns are required for PDF posts, carousel posts, and video covers

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS original_pdf_url text,
ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Add comments for documentation
COMMENT ON COLUMN public.posts.original_pdf_url IS 'URL of the original PDF file for PDF-type posts';
COMMENT ON COLUMN public.posts.media_urls IS 'Array of media URLs for carousel-style posts';
COMMENT ON COLUMN public.posts.cover_image_url IS 'Thumbnail or cover image URL for videos and PDFs';
