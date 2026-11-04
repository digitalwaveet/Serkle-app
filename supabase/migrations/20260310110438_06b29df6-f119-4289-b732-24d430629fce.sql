
CREATE TABLE public.expert_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  specialty TEXT NOT NULL,
  bio TEXT,
  years_experience INTEGER,
  certifications TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expert_verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
ON public.expert_verification_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own requests
CREATE POLICY "Users can create own requests"
ON public.expert_verification_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
ON public.expert_verification_requests
FOR SELECT
TO authenticated
USING (public.is_any_admin(auth.uid()));

-- Admins can update requests
CREATE POLICY "Admins can update requests"
ON public.expert_verification_requests
FOR UPDATE
TO authenticated
USING (public.is_any_admin(auth.uid()));
