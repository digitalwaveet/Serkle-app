-- Fix sequence generation by handling NULL values in current_seq
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
        SET current_seq = COALESCE(current_seq, 0) + 1 
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

-- Fix any conversations that have a NULL current_seq but have messages
UPDATE public.conversations c
SET current_seq = COALESCE((SELECT MAX(seq) FROM public.messages m WHERE m.conversation_id = c.id), 0)
WHERE current_seq IS NULL;

-- Backfill seq for any messages that accidentally got NULL due to the previous bug
WITH numbered_messages AS (
    SELECT id, conversation_id, ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at ASC) as row_num
    FROM public.messages
)
UPDATE public.messages m
SET seq = nm.row_num
FROM numbered_messages nm
WHERE m.id = nm.id AND m.seq IS NULL;

-- Ensure the maximum seq is accurately represented after the backfill
UPDATE public.conversations c
SET current_seq = COALESCE((SELECT MAX(seq) FROM public.messages m WHERE m.conversation_id = c.id), 0);
