-- Add is_thread field to questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS is_thread boolean DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_questions_is_thread ON public.questions(is_thread);
CREATE INDEX IF NOT EXISTS idx_questions_category ON public.questions(category);

-- Add is_verified field to expert_profiles if not exists
ALTER TABLE public.expert_profiles 
ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Add featured_answer_id to expert_profiles
ALTER TABLE public.expert_profiles 
ADD COLUMN IF NOT EXISTS featured_answer_id uuid REFERENCES public.answers(id) ON DELETE SET NULL;