
-- AI content moderation results table
CREATE TABLE public.ai_moderation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL, -- 'post', 'comment', 'video_comment'
  content_id UUID NOT NULL,
  content_text TEXT,
  user_id UUID,
  spam_score NUMERIC(3,2) DEFAULT 0,
  hate_score NUMERIC(3,2) DEFAULT 0,
  nsfw_score NUMERIC(3,2) DEFAULT 0,
  overall_risk TEXT DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  ai_reasoning TEXT,
  auto_action TEXT, -- null, 'flagged', 'hidden', 'removed'
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_action TEXT, -- 'approved', 'hidden', 'removed'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_ai_moderation_risk ON public.ai_moderation_results(overall_risk);
CREATE INDEX idx_ai_moderation_content ON public.ai_moderation_results(content_type, content_id);
CREATE INDEX idx_ai_moderation_created ON public.ai_moderation_results(created_at DESC);

-- RLS
ALTER TABLE public.ai_moderation_results ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage
CREATE POLICY "Admins can manage ai_moderation_results"
  ON public.ai_moderation_results
  FOR ALL
  TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Auto-moderation rules table
CREATE TABLE public.auto_moderation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL DEFAULT 'threshold', -- 'threshold', 'keyword', 'pattern'
  conditions JSONB NOT NULL DEFAULT '{}',
  action TEXT NOT NULL DEFAULT 'flag', -- 'flag', 'hide', 'remove'
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.auto_moderation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage auto_moderation_rules"
  ON public.auto_moderation_rules
  FOR ALL
  TO authenticated
  USING (public.is_any_admin(auth.uid()));
