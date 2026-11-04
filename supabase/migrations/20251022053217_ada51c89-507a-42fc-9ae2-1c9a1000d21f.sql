-- Create questions table with anonymous support
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_anonymous BOOLEAN DEFAULT false,
  anonymous_name TEXT,
  views INTEGER DEFAULT 0,
  ai_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create answers table
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_helpful BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create expert_profiles table
CREATE TABLE public.expert_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  specialty TEXT NOT NULL,
  bio TEXT,
  years_experience INTEGER,
  certifications TEXT[],
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create thread_updates table
CREATE TABLE public.thread_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  update_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create question_votes table
CREATE TABLE public.question_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, user_id)
);

-- Create answer_votes table
CREATE TABLE public.answer_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID REFERENCES public.answers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(answer_id, user_id)
);

-- Create thread_update_votes table
CREATE TABLE public.thread_update_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_update_id UUID REFERENCES public.thread_updates(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(thread_update_id, user_id)
);

-- Enable RLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_update_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for questions (allow anonymous posting)
CREATE POLICY "Anyone can view questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Anyone can create questions" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own questions" ON public.questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own questions" ON public.questions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for answers
CREATE POLICY "Anyone can view answers" ON public.answers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create answers" ON public.answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON public.answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own answers" ON public.answers FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for expert_profiles
CREATE POLICY "Anyone can view expert profiles" ON public.expert_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create own expert profile" ON public.expert_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expert profile" ON public.expert_profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for thread_updates
CREATE POLICY "Anyone can view thread updates" ON public.thread_updates FOR SELECT USING (true);
CREATE POLICY "Question owners can create thread updates" ON public.thread_updates 
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.questions WHERE id = question_id AND user_id = auth.uid()));

-- RLS Policies for votes
CREATE POLICY "Anyone can view question votes" ON public.question_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote on questions" ON public.question_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own question votes" ON public.question_votes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view answer votes" ON public.answer_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote on answers" ON public.answer_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own answer votes" ON public.answer_votes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view thread update votes" ON public.thread_update_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote on thread updates" ON public.thread_update_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own thread update votes" ON public.thread_update_votes FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_questions_user_id ON public.questions(user_id);
CREATE INDEX idx_questions_category ON public.questions(category);
CREATE INDEX idx_questions_created_at ON public.questions(created_at DESC);
CREATE INDEX idx_questions_is_anonymous ON public.questions(is_anonymous);

CREATE INDEX idx_answers_question_id ON public.answers(question_id);
CREATE INDEX idx_answers_user_id ON public.answers(user_id);

CREATE INDEX idx_thread_updates_question_id ON public.thread_updates(question_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_updates;

-- Triggers for updated_at
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_answers_updated_at BEFORE UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expert_profiles_updated_at BEFORE UPDATE ON public.expert_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();