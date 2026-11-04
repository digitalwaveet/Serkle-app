-- Add recording_url to circle_events for past event videos
ALTER TABLE public.circle_events 
ADD COLUMN recording_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.circle_events.recording_url IS 'URL to the recorded video for past events';