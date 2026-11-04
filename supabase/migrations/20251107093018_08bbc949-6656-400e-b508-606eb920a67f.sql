-- Add visibility column to live_streams table
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'circle'));