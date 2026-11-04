-- Add missing column to live_streams table
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS location_visible boolean DEFAULT false;