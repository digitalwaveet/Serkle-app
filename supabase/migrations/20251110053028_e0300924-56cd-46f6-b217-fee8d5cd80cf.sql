-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create conversation_members table
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(conversation_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations they are part of"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- RLS Policies for conversation_members
CREATE POLICY "Users can view conversation members for their conversations"
  ON public.conversation_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own conversation member record"
  ON public.conversation_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX idx_conversation_members_conversation_id ON public.conversation_members(conversation_id);

-- Function to get or create a conversation between two users
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_user1_id UUID, _user2_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conversation_id UUID;
BEGIN
  -- Try to find existing conversation
  SELECT cm1.conversation_id INTO _conversation_id
  FROM conversation_members cm1
  INNER JOIN conversation_members cm2 
    ON cm1.conversation_id = cm2.conversation_id
  WHERE cm1.user_id = _user1_id 
    AND cm2.user_id = _user2_id
    AND (
      SELECT COUNT(*) 
      FROM conversation_members 
      WHERE conversation_id = cm1.conversation_id
    ) = 2
  LIMIT 1;

  -- If conversation doesn't exist, create it
  IF _conversation_id IS NULL THEN
    INSERT INTO conversations DEFAULT VALUES
    RETURNING id INTO _conversation_id;
    
    -- Add both users as members
    INSERT INTO conversation_members (conversation_id, user_id)
    VALUES (_conversation_id, _user1_id), (_conversation_id, _user2_id);
  END IF;

  RETURN _conversation_id;
END;
$$;

-- Function to get conversation with last message and unread count
CREATE OR REPLACE FUNCTION public.get_user_conversations(_user_id UUID)
RETURNS TABLE(
  conversation_id UUID,
  other_user_id UUID,
  other_user_name TEXT,
  other_user_username TEXT,
  other_user_avatar TEXT,
  other_user_initials TEXT,
  other_user_online BOOLEAN,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_sender_id UUID,
  unread_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (c.id)
    c.id as conversation_id,
    p.id as other_user_id,
    p.name as other_user_name,
    p.username as other_user_username,
    p.avatar_url as other_user_avatar,
    p.initials as other_user_initials,
    p.is_online as other_user_online,
    m.content as last_message,
    m.created_at as last_message_at,
    m.sender_id as last_message_sender_id,
    (
      SELECT COUNT(*)
      FROM messages msg
      WHERE msg.conversation_id = c.id
        AND msg.sender_id != _user_id
        AND msg.created_at > (
          SELECT last_read_at 
          FROM conversation_members 
          WHERE conversation_id = c.id AND user_id = _user_id
        )
    ) as unread_count
  FROM conversations c
  INNER JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = _user_id
  INNER JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id != _user_id
  INNER JOIN profiles p ON cm2.user_id = p.id
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id
    FROM messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  ORDER BY c.id, m.created_at DESC NULLS LAST;
$$;

-- Function to mark conversation as read
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id UUID, _user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE conversation_members
  SET last_read_at = now()
  WHERE conversation_id = _conversation_id
    AND user_id = _user_id;
$$;

-- Trigger to update conversation updated_at on new message
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;