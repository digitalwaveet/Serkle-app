-- Add missing columns to thread_updates table
ALTER TABLE public.thread_updates 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS update_number integer NOT NULL DEFAULT 1;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_thread_updates_question_id ON public.thread_updates(question_id);
CREATE INDEX IF NOT EXISTS idx_thread_updates_user_id ON public.thread_updates(user_id);

-- Update RLS policies for thread_updates
DROP POLICY IF EXISTS "Question owners can create thread updates" ON public.thread_updates;

CREATE POLICY "Question owners can create thread updates"
ON public.thread_updates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM questions
    WHERE questions.id = thread_updates.question_id
    AND questions.user_id = auth.uid()
  )
);

-- Add policy for deleting thread updates
CREATE POLICY "Users can delete own thread updates"
ON public.thread_updates
FOR DELETE
USING (auth.uid() = user_id);