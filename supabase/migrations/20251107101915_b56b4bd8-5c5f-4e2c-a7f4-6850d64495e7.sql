-- Create live_messages table
CREATE TABLE IF NOT EXISTS public.live_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view live messages"
  ON public.live_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_streams
      WHERE live_streams.id = live_messages.stream_id
      AND live_streams.status = 'live'
    )
  );

CREATE POLICY "Authenticated users can send live messages"
  ON public.live_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_live_messages_stream_id ON public.live_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_messages_created_at ON public.live_messages(created_at DESC);