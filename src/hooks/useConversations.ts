import { useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '@/integrations/supabase/client';
import { chatDb } from '@/lib/db';
import { syncConversations, syncPinnedConversations, togglePinnedConversation } from '@/lib/sync';
import { useEffect, useCallback } from 'react';

export interface Conversation {
  conversation_id: string;
  other_user_id: string | null;
  other_user_name: string;
  other_user_username: string | null;
  other_user_avatar: string | null;
  other_user_initials: string;
  other_user_online: boolean;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  is_group: boolean;
  group_name: string | null;
  group_avatar_url: string | null;
  member_count: number;
}

export const useConversations = (userId: string | undefined) => {
  const conversations = useLiveQuery(async () => {
    if (!userId) return [];
    const list = await chatDb.conversations_meta.toArray();
    return list.sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [userId]);

  useEffect(() => {
    if (userId) {
      syncConversations(userId).catch(console.error);
      syncPinnedConversations(userId).catch(console.error);
    }
    const refresh = () => {
      if (userId && document.visibilityState === 'visible') void syncConversations(userId).catch(console.error);
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      clearInterval(timer);
    };
  }, [userId]);

  const refetch = useCallback(async () => {
    if (userId) {
      await syncConversations(userId);
    }
  }, [userId]);

  return {
    conversations: conversations || [],
    isLoading: conversations === undefined,
    error: null,
    refetch,
  };
};

export const useCreateConversation = () => {
  const queryClient = useQueryClient();

  const createConversation = async (currentUserId: string, otherUserId: string) => {
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      _user1_id: currentUserId,
      _user2_id: otherUserId,
    });

    if (error) throw error;

    // Trigger background sync instead of just invalidating
    if (currentUserId) {
      syncConversations(currentUserId).catch(console.error);
    }

    return data as string;
  };

  return { createConversation };
};

/**
 * Hook to access pinned conversation IDs from Dexie.
 */
export const usePinnedConversations = (userId: string | undefined) => {
  const pinnedIds = useLiveQuery(async () => {
    if (!userId) return new Set<string>();
    const pins = await chatDb.pinned_conversations.toArray();
    return new Set(pins.map(p => p.conversation_id));
  }, [userId]);

  return pinnedIds || new Set<string>();
};

/**
 * Hook to toggle pinned state.
 */
export const useTogglePin = () => {
  const togglePin = useCallback(async (userId: string, conversationId: string, isPinned: boolean) => {
    await togglePinnedConversation(userId, conversationId, isPinned);
  }, []);

  return { togglePin };
};
