import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { playMessageSound } from '@/utils/notificationSound';
import { chatDb, sanitizeMessage } from '@/lib/db';
import { syncConversations } from '@/lib/sync';

/**
 * App-level component that listens for realtime changes to messages and notifications,
 * then instantly invalidates relevant queries so badges update everywhere without reload.
 */
const GlobalRealtimeListener = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('global-badge-updates')
      // Instant message badge: any new/changed message triggers conversation refetch
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as any;
          if (!msg.conversation_id || !msg.sender_id) return;
          if (msg.sender_id !== user.id) playMessageSound();
          await chatDb.transaction('rw', chatDb.messages, chatDb.conversations_meta, chatDb.read_receipts, async () => {
            const existing = await chatDb.messages.get(msg.id);
            const receipt = await chatDb.read_receipts.get([msg.conversation_id, user.id]);
            const conv = await chatDb.conversations_meta.get(msg.conversation_id);
            const arrivedSeq = Number(msg.created_seq ?? msg.seq ?? 0);
            const unread = !existing && msg.sender_id !== user.id && !msg.deleted_for_everyone
              && arrivedSeq > (receipt?.last_read_seq || 0);
            await chatDb.messages.put(sanitizeMessage({ ...msg, seq: Number(msg.seq), created_seq: arrivedSeq, sync_status: 'sent' }));
            if (conv) {
              await chatDb.conversations_meta.put({
                ...conv,
                unread_count: (conv.unread_count || 0) + (unread ? 1 : 0),
                unread_latest_seq: Math.max(conv.unread_latest_seq || 0, Number(msg.seq || 0)),
                ...(msg.created_at >= (conv.last_message_at || '') ? {
                  last_message: msg.content, last_message_at: msg.created_at, last_message_sender_id: msg.sender_id
                } : {}),
              });
            }
          });
          // Reconcile unknown conversations and counts from the server; never
          // mark read merely because the conversation route is open.
          void syncConversations(user.id).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          void syncConversations(user.id).catch(console.error);
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'read_receipts', filter: `user_id=eq.${user.id}` },
        async payload => {
          if (payload.eventType !== 'DELETE') {
            const incoming = payload.new as { conversation_id: string; user_id: string; last_read_seq: number; updated_at: string };
            await chatDb.transaction('rw', chatDb.read_receipts, async () => {
              const current = await chatDb.read_receipts.get([incoming.conversation_id, user.id]);
              if (!current || Number(incoming.last_read_seq) > current.last_read_seq) await chatDb.read_receipts.put(incoming);
            });
          }
          void syncConversations(user.id).catch(console.error);
        }
      )
      // When read status updates, refresh conversations for badge count
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_members' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      // Instant notification badge: new push_notifications
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'push_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['push-notifications'] });
        }
      )
      // When notification is marked read
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'push_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['push-notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return null;
};

export default GlobalRealtimeListener;
