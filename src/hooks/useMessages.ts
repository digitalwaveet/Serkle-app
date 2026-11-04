import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { chatDb, sanitizeMessage } from '@/lib/db';
import { syncConversation, processSyncQueue } from '@/lib/sync';
import { useNotifications } from './useNotifications';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  attachment_url: string;
  reply_to_id: string;
  forwarded_from_name?: string;
  created_at: string;
  updated_at: string;
  sender?: {
    name: string;
    username: string;
    avatar_url: string | null;
    initials: string;
  };
}

export const useMessages = (conversationId: string | null, userId: string | undefined, canMarkRead = false) => {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [limit, setLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const lastSyncedReadSeq = useRef(0);
  const fetchingIdsRef = useRef<Set<string>>(new Set());
  const syncInFlight = useRef(false);
  const syncPending = useRef(false);

  // 1. Local data stream via Dexie (Replaces network fetch)
  const localMessages = useLiveQuery(
    async () => {
      if (!conversationId) return [];
      
      const msgs = await chatDb.messages
        .where('[conversation_id+created_at]')
        .between([conversationId, ''], [conversationId, '\uffff'])
        .reverse()
        .limit(limit)
        .toArray();
      
      const sorted = msgs.reverse();
      setHasMore(msgs.length === limit);
      return sorted;
    },
    [conversationId, limit]
  );

  // 2. Resolve missing sender profiles via Dexie Cache
  const profileCache = useLiveQuery(
    async () => {
      if (!localMessages || localMessages.length === 0) return {};
      const senderIds = [...new Set(localMessages.map(m => m.sender_id))];
      const profiles = await chatDb.profiles.bulkGet(senderIds);
      const cache: Record<string, any> = {};
      profiles.forEach((p, idx) => {
        if (p) cache[senderIds[idx]] = p;
      });
      return cache;
    },
    [localMessages]
  );

  useEffect(() => {
    if (!localMessages || localMessages.length === 0 || !profileCache) return;
    
    const missingSenderIds = [...new Set(localMessages.map(m => m.sender_id))]
      .filter(id => !profileCache[id] && !fetchingIdsRef.current.has(id));
      
    if (missingSenderIds.length > 0) {
      missingSenderIds.forEach(id => fetchingIdsRef.current.add(id));
      
      Promise.resolve(supabase.from('profiles')
        .select('id, name, username, avatar_url, initials')
        .in('id', missingSenderIds))
        .then(({ data }) => {
          if (data && data.length > 0) {
            chatDb.profiles.bulkPut(data.map(p => ({
              id: p.id,
              name: p.name,
              username: p.username,
              avatar_url: p.avatar_url,
              initials: p.initials
            }))).catch(err => console.error('[Sync] Profile cache update failed:', err));
          }
          
          // Clear from fetching list after a short delay
          setTimeout(() => {
            missingSenderIds.forEach(id => fetchingIdsRef.current.delete(id));
          }, 1000);
        })
        .catch(err => {
          console.error('[Sync] Profile fetch error:', err);
          missingSenderIds.forEach(id => fetchingIdsRef.current.delete(id));
        });
    }
  }, [localMessages, profileCache]);

  // 3. Protected Sync Logic - Fixes Sync Storm
  const runSync = useCallback(async () => {
    if (!conversationId) return;
    if (syncInFlight.current) {
      syncPending.current = true;
      return;
    }

    syncInFlight.current = true;
    setIsSyncing(true);

    try {
      await syncConversation(conversationId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unable to refresh messages'));
      console.error('[Sync] Conversation sync error:', err);
    } finally {
      syncInFlight.current = false;
      setIsSyncing(false);
      if (syncPending.current) {
        syncPending.current = false;
        runSync();
      }
    }
  }, [conversationId]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const debouncedSync = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(runSync, 150);
  }, [runSync]);

  // 4. Dual-Channel Realtime Setup
  useEffect(() => {
    if (!conversationId) return;

    // Initial background sync
    runSync();

    // Fast Path: Broadcast Channel (delivered in ~50ms)
    const broadcastChannel = supabase
      .channel(`chat:${conversationId}`)
      // Broadcasts are hints, never trusted message content.
      .on('broadcast', { event: 'new_message' }, debouncedSync)
      .subscribe();

    // Reliability Fallback: Postgres Changes Channel (delivered in ~300-800ms)
    const pgChannel = supabase
      .channel(`pg:messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          debouncedSync();
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${conversationId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'read_receipts', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const receipt = payload.new as { conversation_id: string; user_id: string; last_read_seq: number; updated_at: string };
            await chatDb.transaction('rw', chatDb.read_receipts, async () => {
              const current = await chatDb.read_receipts.get([receipt.conversation_id, receipt.user_id]);
              if (!current || receipt.last_read_seq > current.last_read_seq) await chatDb.read_receipts.put(receipt);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(pgChannel);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [conversationId, userId, queryClient, runSync, debouncedSync]);

  const { markConversationNotificationsAsRead } = useNotifications();
  useEffect(() => { lastSyncedReadSeq.current = 0; }, [conversationId, userId]);
  
  // 5. Optimized Read-Receipt Loop - Fixes redundant sync triggers
  useEffect(() => {
    const lastMsg = localMessages?.[localMessages.length - 1];
    if (!canMarkRead || !conversationId || !userId || !lastMsg?.seq || lastMsg.seq <= lastSyncedReadSeq.current) return;

    // Debounce read-receipt write for a better feel
    const timer = setTimeout(async () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;

      try {
        const receipt = {
          user_id: userId,
          conversation_id: conversationId,
          last_read_seq: lastMsg.seq!,
          updated_at: new Date().toISOString()
        };

        await chatDb.transaction('rw', chatDb.read_receipts, chatDb.conversations_meta, chatDb.sync_queue, async () => {
          const existing = await chatDb.read_receipts.get([conversationId, userId]);
          if (existing && existing.last_read_seq >= receipt.last_read_seq) return;
          await chatDb.read_receipts.put(receipt);
          await chatDb.conversations_meta.update(conversationId, { unread_count: 0 });
          await chatDb.sync_queue.put({
            id: `read_${conversationId}_${userId}`,
            type: 'read_receipt',
            payload: receipt,
            created_at: new Date().toISOString(),
            retry_count: 0
          });
        });
        lastSyncedReadSeq.current = lastMsg.seq!;

        // 3. Trigger queue processing
        processSyncQueue().catch(console.error);

        // 4. Mark related notifications as read on server
        markConversationNotificationsAsRead.mutate(conversationId);
        
        // 5. Optimistic update for React Query cache (fallback)
        queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }, 300); // Reduced delay for more responsive feel

    return () => clearTimeout(timer);
  }, [localMessages && localMessages.length > 0 ? localMessages[localMessages.length - 1].seq : null, conversationId, userId, canMarkRead]);

  const messagesWithSenders = useMemo(() => {
    return localMessages?.map((msg: any) => ({
      ...msg,
      sender: profileCache?.[msg.sender_id] ? {
        name: profileCache[msg.sender_id].name,
        username: profileCache[msg.sender_id].username,
        avatar_url: profileCache[msg.sender_id].avatar_url,
        initials: profileCache[msg.sender_id].initials
      } : undefined
    })) || [];
  }, [localMessages, profileCache]);

  const loadMore = useCallback(() => {
    if (hasMore) {
      setLimit(prev => prev + 50);
    }
  }, [hasMore]);

  return {
    messages: (messagesWithSenders as Message[]) || [],
    isLoading: localMessages === undefined,
    isSyncing,
    hasMore,
    loadMore,
    error,
    refetch: runSync,
  };
};

export const useOtherUserLastRead = (conversationId: string | null, otherUserId: string | null) => {
  const otherReceipt = useLiveQuery(() => {
    if (!conversationId || !otherUserId) return null;
    return chatDb.read_receipts
      .where('[conversation_id+user_id]')
      .equals([conversationId, otherUserId])
      .first();
  }, [conversationId, otherUserId]);

  return otherReceipt?.last_read_seq || 0;
};

export const useRetryMessage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const msg = await chatDb.messages.get(messageId);
      if (!msg) throw new Error('Message not found');

      // Add to sync queue if not already there
      const existingQueueItem = await chatDb.sync_queue.get(messageId);
      if (!existingQueueItem) {
        await chatDb.sync_queue.put({
          id: messageId,
          type: 'message_insert',
          payload: {
            id: msg.id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            content: msg.content,
            message_type: msg.message_type,
            attachment_url: msg.attachment_url,
            reply_to_id: msg.reply_to_id,
            forwarded_from_name: msg.forwarded_from_name,
            created_at: msg.created_at,
            updated_at: msg.updated_at
          },
          created_at: new Date().toISOString(),
          retry_count: 0,
          status: 'pending'
        });
      } else {
        await chatDb.sync_queue.update(messageId, {
          status: 'pending',
          retry_count: 0
        });
      }

      // Update status to pending
      const existing = await chatDb.messages.get(messageId);
      if (existing) {
        existing.sync_status = 'pending';
        await chatDb.messages.put(existing);
      }

      toast({ title: 'Retrying message...', variant: 'default' });

      // Trigger sync
      processSyncQueue().catch(console.error);
    },
    onSuccess: () => {
      // Refresh local messages if needed or let hooks handle it
    },
    onError: () => toast({ title: 'Could not retry this message', variant: 'destructive' }),
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      conversationId,
      senderId,
      content,
      messageType = 'text',
      attachmentUrl = null,
      replyToId = null,
      id: providedId
    }: {
      conversationId: string;
      senderId: string;
      content: string;
      messageType?: string;
      attachmentUrl?: string | null;
      replyToId?: string | null;
      id?: string;
    }) => {
      const messageId = providedId || crypto.randomUUID();
      const now = new Date().toISOString();

      const insertData = {
        id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_type: messageType,
        attachment_url: attachmentUrl || '',
        reply_to_id: replyToId || '',
        created_at: now,
        updated_at: now,
      };

      // Save the message AND outbox entry atomically before any network work.
      await chatDb.transaction('rw', chatDb.messages, chatDb.sync_queue, async () => {
        await chatDb.messages.put(sanitizeMessage({ ...insertData, sync_status: 'pending' }));
        await chatDb.sync_queue.put({
          id: messageId,
          type: 'message_insert',
          payload: insertData,
          created_at: now,
          retry_count: 0,
          status: 'pending'
        });
      });

      return insertData;
    },
    onSuccess: (_, variables) => {
      processSyncQueue().then(() => syncConversation(variables.conversationId)).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast({ title: 'Failed to send message', variant: 'destructive' });
    },
  });

  return {
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
  };
};

export const useUpdateMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      messageId, 
      attachmentUrl, 
      syncStatus = 'sent' 
    }: { 
      messageId: string; 
      attachmentUrl: string; 
      syncStatus?: 'sent' | 'pending' | 'failed' 
    }) => {
      // 1. Update local DB
      const existingUpdate = await chatDb.messages.get(messageId);
      if (existingUpdate) {
        existingUpdate.attachment_url = attachmentUrl;
        existingUpdate.sync_status = syncStatus;
        await chatDb.messages.put(existingUpdate);
      }

      // 2. Fetch the updated message to queue it
      const msg = await chatDb.messages.get(messageId);
      if (msg) {
        await chatDb.sync_queue.put({
          id: messageId,
          type: 'message_insert',
          payload: {
            id: msg.id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            content: msg.content,
            message_type: msg.message_type,
            attachment_url: msg.attachment_url,
            reply_to_id: msg.reply_to_id,
            forwarded_from_name: msg.forwarded_from_name,
            created_at: msg.created_at,
            updated_at: new Date().toISOString()
          },
          created_at: new Date().toISOString(),
          retry_count: 0,
          status: 'pending'
        });
        
        // 3. Trigger sync
        processSyncQueue().catch(console.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });
};
