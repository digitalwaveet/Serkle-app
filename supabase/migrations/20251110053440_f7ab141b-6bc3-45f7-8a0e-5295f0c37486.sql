-- Fix infinite recursion in conversation_members RLS policies
-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON conversation_members;
DROP POLICY IF EXISTS "Users can join conversations" ON conversation_members;
DROP POLICY IF EXISTS "Users can leave conversations" ON conversation_members;

-- Create a security definer function to check membership without recursion
CREATE OR REPLACE FUNCTION public.is_conversation_member(conversation_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_members.conversation_id = is_conversation_member.conversation_id
    AND conversation_members.user_id = is_conversation_member.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view their conversation memberships"
ON conversation_members FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can create conversation memberships"
ON conversation_members FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their read status"
ON conversation_members FOR UPDATE
USING (auth.uid() = user_id);

-- Fix messages policies to use the security definer function
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON messages;

CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Users can send messages to their conversations"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  public.is_conversation_member(conversation_id, auth.uid())
);