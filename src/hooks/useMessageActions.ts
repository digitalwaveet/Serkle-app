import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { chatDb } from '@/lib/db';
import { Message } from './useMessages';
import { copyChatMediaToConversation } from '@/lib/chatMedia';

export const useMessageReactions = (conversationId: string | null) => {
  const queryClient = useQueryClient();

  const reactions = useLiveQuery(
    async () => {
      if (!conversationId) return [];
      
      // Step 1: Get all message IDs for this conversation from local DB
      const msgIds = await chatDb.messages
        .where('conversation_id')
        .equals(conversationId)
        .primaryKeys();
        
      if (msgIds.length === 0) return [];

      // Step 2: Fetch reactions for these message IDs from local DB
      return await chatDb.message_reactions
        .where('message_id')
        .anyOf(msgIds)
        .toArray();
    },
    [conversationId],
    []
  );

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, userId, emoji }: { messageId: string; userId: string; emoji: string }) => {
      // 1. Optimistic update in local Dexie DB for instant feedback
      const existingInDexie = await chatDb.message_reactions
        .where('[message_id+user_id+emoji]')
        .equals([messageId, userId, emoji])
        .first();

      if (existingInDexie) {
        await chatDb.message_reactions.delete(existingInDexie.id);
      } else {
        await chatDb.message_reactions.add({
          id: crypto.randomUUID(),
          message_id: messageId,
          user_id: userId,
          emoji,
          created_at: new Date().toISOString()
        });
      }

      // 2. Persist to Supabase
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from('message_reactions').delete().eq('id', existing.id);
      } else {
        const { error } = await supabase.from('message_reactions').insert({
          message_id: messageId,
          user_id: userId,
          emoji,
        });
        if (error) throw error;
      }
    }
  });

  return { reactions: reactions || [], toggleReaction };
};

export const useEditMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content, conversationId }: { messageId: string; content: string; conversationId: string }) => {
      // Keep a snapshot so a rejected edit does not remain visible as saved.
      const existingEdit = await chatDb.messages.get(messageId);
      const previous = existingEdit ? { ...existingEdit } : null;
      const editedAt = new Date().toISOString();
      if (existingEdit) {
        existingEdit.content = content;
        existingEdit.is_edited = true;
        existingEdit.updated_at = editedAt;
        await chatDb.messages.put(existingEdit);
      }

      try {
        const { error } = await supabase
          .from('messages')
          .update({ content, is_edited: true, updated_at: editedAt })
          .eq('id', messageId)
          .select('id')
          .single();
        if (error) throw error;
      } catch (error) {
        await chatDb.transaction('rw', chatDb.messages, async () => {
          const current = await chatDb.messages.get(messageId);
          // Do not roll back a newer edit or a deletion that arrived meanwhile.
          if (previous && current?.updated_at === editedAt && current.content === content && !current.deleted_for_everyone) {
            await chatDb.messages.put(previous);
          }
        });
        throw error;
      }
      return conversationId;
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      toast.success('Message edited');
    },
    onError: () => toast.error('Failed to edit message'),
  });
};

export const useDeleteMessage = () => {
  const queryClient = useQueryClient();

  const deleteForMe = useMutation({
    mutationFn: async ({ messageId, userId, conversationId }: { messageId: string; userId: string; conversationId: string }) => {
      // 1. Optimistic local delete
      await chatDb.messages.delete(messageId);

      // 2. Server persistence
      const { error } = await supabase.from('message_deletions').insert({
        message_id: messageId,
        user_id: userId,
      });
      if (error) throw error;
      return conversationId;
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      toast.success('Message deleted for you');
    },
  });

  const deleteForEveryone = useMutation({
    mutationFn: async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      // 1. Optimistic local update
      const existingDel = await chatDb.messages.get(messageId);
      if (existingDel) {
        existingDel.deleted_for_everyone = true;
        existingDel.content = 'This message was deleted';
        await chatDb.messages.put(existingDel);
      }

      // 2. Server update
      const { error } = await supabase
        .from('messages')
        .update({ deleted_for_everyone: true, content: 'This message was deleted' })
        .eq('id', messageId);
      if (error) throw error;
      return conversationId;
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      toast.success('Message deleted for everyone');
    },
  });

  return { deleteForMe, deleteForEveryone };
};

export const useForwardMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, messageType, attachmentUrl, senderName, targetConversationIds, senderId }: {
      content: string;
      messageType: string;
      attachmentUrl?: string;
      senderName: string;
      targetConversationIds: string[];
      senderId: string;
    }) => {
      const isFile = ['photo', 'video', 'voice', 'audio', 'file', 'document', 'pdf'].includes(messageType);
      // Bound memory/network use when forwarding large files to many chats.
      const inserts = [];
      for (const convId of [...new Set(targetConversationIds)]) {
        inserts.push({
        conversation_id: convId,
        sender_id: senderId,
        content,
        message_type: messageType,
        attachment_url: attachmentUrl && isFile ? await copyChatMediaToConversation(attachmentUrl, convId) : attachmentUrl || null,
        forwarded_from_name: senderName,
        });
      }

      const { error } = await supabase.from('messages').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Message forwarded');
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to forward message'),
  });
};

export const usePinnedMessage = (conversationId: string | null, messages: Message[]) => {
  const queryClient = useQueryClient();

  // Fetch pinned message ID from conversation
  const { data: pinnedMessageId } = useQuery({
    queryKey: ['pinned-message', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from('conversations')
        .select('pinned_message_id')
        .eq('id', conversationId)
        .single();
      if (error) return null;
      return data?.pinned_message_id || null;
    },
    enabled: !!conversationId,
  });

  // Resolve pinned message from loaded messages
  const pinnedMessage = useMemo(() => {
    if (!pinnedMessageId || !messages.length) return null;
    const msg = messages.find(m => m.id === pinnedMessageId);
    if (!msg) return null;
    return {
      id: msg.id,
      content: msg.content,
      senderId: msg.sender_id,
      senderName: msg.sender?.name || 'Unknown',
      messageType: (msg as any).message_type || 'text',
      attachmentUrl: (msg as any).attachment_url,
    };
  }, [pinnedMessageId, messages]);

  const pinMutation = useMutation({
    mutationFn: async (messageId: string | null) => {
      if (!conversationId) throw new Error('No conversation');
      const { error } = await supabase
        .from('conversations')
        .update({ pinned_message_id: messageId })
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: (_, messageId) => {
      queryClient.invalidateQueries({ queryKey: ['pinned-message', conversationId] });
      toast.success(messageId ? 'Message pinned' : 'Message unpinned');
    },
    onError: () => toast.error('Failed to update pin'),
  });

  return {
    pinnedMessage,
    pinMessage: (messageId: string) => pinMutation.mutate(messageId),
    unpinMessage: () => pinMutation.mutate(null),
  };
};
