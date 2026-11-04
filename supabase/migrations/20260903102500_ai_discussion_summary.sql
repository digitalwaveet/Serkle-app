-- Migration to add ai_discussion_summary to public.questions
-- This stores structured discussion summaries synthesized from community & expert answers,
-- rather than standalone AI-generated answers.

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS ai_discussion_summary JSONB;

COMMENT ON COLUMN public.questions.ai_discussion_summary IS 'Stores AI-generated discussion summary synthesized from community and expert answers.';
