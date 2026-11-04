
-- Appeals table
CREATE TABLE public.appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  appeal_type TEXT NOT NULL DEFAULT 'ban',
  reason TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  moderator_id UUID,
  moderator_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- Admins can read all appeals
CREATE POLICY "Admins can read all appeals"
  ON public.appeals FOR SELECT
  TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Admins can update appeals
CREATE POLICY "Admins can update appeals"
  ON public.appeals FOR UPDATE
  TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Users can insert their own appeals
CREATE POLICY "Users can insert own appeals"
  ON public.appeals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own appeals
CREATE POLICY "Users can read own appeals"
  ON public.appeals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add columns to content_reports if missing
ALTER TABLE public.content_reports 
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
