-- Add message_type and attachment_url to messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachment_url text;

-- Add location and voice_url to posts table
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS voice_url text;