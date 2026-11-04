
-- Admin notifications table for critical event alerts
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text,
  severity text NOT NULL DEFAULT 'info',
  is_read boolean DEFAULT false,
  action_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admin notifications"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can update admin notifications"
  ON public.admin_notifications FOR UPDATE TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Webhook endpoints table
CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  event_types text[] NOT NULL DEFAULT '{}',
  secret text,
  is_active boolean DEFAULT true,
  last_triggered_at timestamptz,
  failure_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhook endpoints"
  ON public.webhook_endpoints FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Bulk action logs
CREATE TABLE public.bulk_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_ids uuid[] NOT NULL DEFAULT '{}',
  performed_by uuid NOT NULL,
  details jsonb DEFAULT '{}',
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bulk_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read bulk action logs"
  ON public.bulk_action_logs FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can insert bulk action logs"
  ON public.bulk_action_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_any_admin(auth.uid()));

-- Enable realtime for admin notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
