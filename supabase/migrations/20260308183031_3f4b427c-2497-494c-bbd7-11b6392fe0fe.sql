
-- User warnings/strikes system
CREATE TABLE public.user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  issued_by uuid NOT NULL,
  warning_type text NOT NULL DEFAULT 'warning',
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  expires_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage warnings"
  ON public.user_warnings FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Admin broadcasts
CREATE TABLE public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  target_audience text NOT NULL DEFAULT 'all',
  channel text NOT NULL DEFAULT 'in_app',
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcasts"
  ON public.admin_broadcasts FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Platform health snapshots
CREATE TABLE public.platform_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read health snapshots"
  ON public.platform_health_snapshots FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can insert health snapshots"
  ON public.platform_health_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_any_admin(auth.uid()));
