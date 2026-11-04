
-- Add SELECT policy for circle members to see all messages in their circle
CREATE POLICY "Circle members can view circle messages"
ON public.circle_messages
FOR SELECT
TO authenticated
USING (is_circle_member(circle_id, auth.uid()));
