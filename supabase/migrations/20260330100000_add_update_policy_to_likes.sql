-- Add UPDATE policy to likes table to allow users to change their reaction type
-- Note: UPSERT operations require both INSERT and UPDATE permissions

CREATE POLICY "Users can update their likes"
  ON public.likes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
