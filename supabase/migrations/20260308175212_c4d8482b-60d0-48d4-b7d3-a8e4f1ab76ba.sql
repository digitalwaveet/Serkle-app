
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'super_admin');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create has_role() security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. Helper: is_any_admin checks admin or super_admin
CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- 5. RLS policies for user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.is_any_admin(auth.uid()));

CREATE POLICY "Super admins can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 6. Create admin_audit_log table
CREATE TABLE public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log" ON public.admin_audit_log
FOR SELECT TO authenticated
USING (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can insert audit log" ON public.admin_audit_log
FOR INSERT TO authenticated
WITH CHECK (public.is_any_admin(auth.uid()));

-- 7. Create admin_settings table
CREATE TABLE public.admin_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.admin_settings
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage settings" ON public.admin_settings
FOR ALL TO authenticated
USING (public.is_any_admin(auth.uid()))
WITH CHECK (public.is_any_admin(auth.uid()));

-- 8. Add status and pinned_at to posts (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='moderation_status') THEN
    ALTER TABLE public.posts ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='pinned_at') THEN
    ALTER TABLE public.posts ADD COLUMN pinned_at TIMESTAMPTZ;
  END IF;
END $$;

-- 9. Add status to videos (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='moderation_status') THEN
    ALTER TABLE public.videos ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- 10. Create content_reports table
CREATE TABLE public.content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL,
    content_type TEXT NOT NULL, -- 'post', 'video', 'comment', 'user'
    content_id UUID NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON public.content_reports
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports" ON public.content_reports
FOR SELECT TO authenticated
USING (public.is_any_admin(auth.uid()) OR auth.uid() = reporter_id);

CREATE POLICY "Admins can update reports" ON public.content_reports
FOR UPDATE TO authenticated
USING (public.is_any_admin(auth.uid()));

-- 11. Add banned_at and suspended_until to profiles for user management
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='banned_at') THEN
    ALTER TABLE public.profiles ADD COLUMN banned_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='suspended_until') THEN
    ALTER TABLE public.profiles ADD COLUMN suspended_until TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='admin_notes') THEN
    ALTER TABLE public.profiles ADD COLUMN admin_notes TEXT;
  END IF;
END $$;
