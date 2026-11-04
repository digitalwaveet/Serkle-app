-- Add live_stream_id column to stories table
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS live_stream_id UUID REFERENCES public.live_streams(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_stories_live_stream_id ON public.stories(live_stream_id);