
-- Scheduled posts table
CREATE TABLE public.scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  media_url text,
  media_urls text[],
  tags text[],
  circle_id uuid,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  published_post_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scheduled posts"
  ON public.scheduled_posts FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()));

CREATE POLICY "Users can manage own scheduled posts"
  ON public.scheduled_posts FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Content review queue table
CREATE TABLE public.content_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  content_preview text,
  reason text NOT NULL DEFAULT 'flagged',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.content_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage review queue"
  ON public.content_review_queue FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()));
