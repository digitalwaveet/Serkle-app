-- Update get_user_conversations to use the new read_receipts table and seq for accurate unread counts
CREATE OR REPLACE FUNCTION public.get_user_conversations(_user_id uuid)
 RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_user_name text, other_user_username text, other_user_avatar text, other_user_initials text, other_user_online boolean, last_message text, last_message_at timestamp with time zone, last_message_sender_id uuid, unread_count bigint, is_group boolean, group_name text, group_avatar_url text, member_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    -- 1-on-1 conversations
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
          AND COALESCE(msg.seq, 999999999) > COALESCE((
            SELECT r.last_read_seq 
            FROM read_receipts r 
            WHERE r.conversation_id = c.id AND r.user_id = _user_id
          ), 0)
      ) as unread_count,
      false as is_group,
      NULL::text as group_name,
      NULL::text as group_avatar_url,
      2::bigint as member_count
    FROM conversations c
    INNER JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = _user_id
    INNER JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id != _user_id
    INNER JOIN profiles p ON cm2.user_id = p.id
    LEFT JOIN LATERAL (
      SELECT msg2.content, msg2.created_at, msg2.sender_id
      FROM messages msg2
      WHERE msg2.conversation_id = c.id
      ORDER BY msg2.created_at DESC
      LIMIT 1
    ) m ON true
    WHERE c.is_group = false
    ORDER BY c.id, m.created_at DESC NULLS LAST
  ) dm

  UNION ALL

  SELECT * FROM (
    SELECT
      c.id as conversation_id,
      NULL::uuid as other_user_id,
      c.group_name as other_user_name,
      NULL::text as other_user_username,
      c.group_avatar_url as other_user_avatar,
      UPPER(LEFT(c.group_name, 2)) as other_user_initials,
      false as other_user_online,
      m.content as last_message,
      m.created_at as last_message_at,
      m.sender_id as last_message_sender_id,
      (
        SELECT COUNT(*)
        FROM messages msg
        WHERE msg.conversation_id = c.id
          AND msg.sender_id != _user_id
          AND COALESCE(msg.seq, 999999999) > COALESCE((
            SELECT r.last_read_seq 
            FROM read_receipts r 
            WHERE r.conversation_id = c.id AND r.user_id = _user_id
          ), 0)
      ) as unread_count,
      true as is_group,
      c.group_name,
      c.group_avatar_url,
      (SELECT COUNT(*) FROM conversation_members cm3 WHERE cm3.conversation_id = c.id) as member_count
    FROM conversations c
    INNER JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = _user_id
    LEFT JOIN LATERAL (
      SELECT msg2.content, msg2.created_at, msg2.sender_id
      FROM messages msg2
      WHERE msg2.conversation_id = c.id
      ORDER BY msg2.created_at DESC
      LIMIT 1
    ) m ON true
    WHERE c.is_group = true
  ) grp

  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;
