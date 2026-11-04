-- Fix search_path for the is_conversation_member function
CREATE OR REPLACE FUNCTION public.is_conversation_member(conversation_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_members.conversation_id = is_conversation_member.conversation_id
    AND conversation_members.user_id = is_conversation_member.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;