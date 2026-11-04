ALTER TABLE public.group_polls ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.group_polls ADD COLUMN IF NOT EXISTS ended_at timestamptz;