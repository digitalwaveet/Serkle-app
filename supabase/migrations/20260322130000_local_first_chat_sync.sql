-- Migration for Local-First Chat Sync

-- 1. Add seq tracking
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS seq BIGINT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS current_seq BIGINT DEFAULT 0;

-- 2. Backfill seq for existing messages
WITH numbered_messages AS (
    SELECT id, conversation_id, ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at ASC) as row_num
    FROM public.messages
)
UPDATE public.messages m
SET seq = nm.row_num
FROM numbered_messages nm
WHERE m.id = nm.id AND m.seq IS NULL;

-- 3. Sync conversations current_seq
UPDATE public.conversations c
SET current_seq = COALESCE((SELECT MAX(seq) FROM public.messages m WHERE m.conversation_id = c.id), 0);

-- 4. Create trigger to maintain seq
CREATE OR REPLACE FUNCTION public.set_message_seq()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_seq BIGINT;
BEGIN
    -- Only bump sequence on INSERT, or UPDATE if message content has changed
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content) THEN
        UPDATE public.conversations 
        SET current_seq = current_seq + 1 
        WHERE id = NEW.conversation_id 
        RETURNING current_seq INTO next_seq;

        NEW.seq := next_seq;
        
        IF TG_OP = 'UPDATE' THEN
            NEW.updated_at = NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_message_seq ON public.messages;
CREATE TRIGGER trigger_set_message_seq
    BEFORE INSERT OR UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_message_seq();

-- 5. Create read_receipts table
CREATE TABLE IF NOT EXISTS public.read_receipts (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    last_read_seq BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, conversation_id)
);

-- RLS for read_receipts
ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own read receipts" ON public.read_receipts;
CREATE POLICY "Users can view their own read receipts"
    ON public.read_receipts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert/update their own read receipts" ON public.read_receipts;
CREATE POLICY "Users can insert/update their own read receipts"
    ON public.read_receipts FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for read_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.read_receipts;

-- 6. RPC for fetching message deltas efficiently
CREATE OR REPLACE FUNCTION public.sync_messages(p_conversation_id UUID, p_after_seq BIGINT)
RETURNS SETOF public.messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT m.*
    FROM public.messages m
    -- Verify the caller is actually a member of this conversation
    JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.conversation_id = p_conversation_id
      AND m.seq > p_after_seq
      AND cm.user_id = auth.uid()
    ORDER BY m.seq ASC;
$$;
