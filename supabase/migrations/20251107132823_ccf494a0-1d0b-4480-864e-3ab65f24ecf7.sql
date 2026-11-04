-- Add INSERT policy for product reviews
CREATE POLICY "Users can create product reviews"
ON product_reviews
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);