-- Create question_bookmarks table
CREATE TABLE public.question_bookmarks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- Create index for better query performance
CREATE INDEX idx_question_bookmarks_user_id ON public.question_bookmarks(user_id);
CREATE INDEX idx_question_bookmarks_question_id ON public.question_bookmarks(question_id);

-- Enable RLS
ALTER TABLE public.question_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS policies for question_bookmarks
CREATE POLICY "Users can bookmark questions"
ON public.question_bookmarks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bookmarks"
ON public.question_bookmarks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can remove own bookmarks"
ON public.question_bookmarks
FOR DELETE
USING (auth.uid() = user_id);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.question_bookmarks;