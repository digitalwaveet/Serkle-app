import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TypingUser {
  user_id: string;
  user_name: string;
}

/**
 * Global typing indicator that subscribes to typing broadcasts
 * for ALL conversations the user is part of.
 * 
 * Used in the ConversationsList to show "typing..." as the preview text,
 * just like WhatsApp/Telegram do.
 */
export const useGlobalTyping = (
  conversationIds: string[],
  currentUserId: string | undefined
) => {
  // Map of conversationId -> Map of userId -> userName
  const [typingMap, setTypingMap] = useState<Map<string, Map<string, string>>>(new Map());
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!currentUserId || conversationIds.length === 0) return;

    // Clean up old channels
    channelsRef.current.forEach(ch => supabase.removeChannel(ch));
    channelsRef.current = [];

    // Subscribe to typing broadcasts for each conversation
    for (const convId of conversationIds) {
      const channel = supabase.channel(`typing-global:${convId}`);

      channel
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (payload.user_id === currentUserId) return;

          const key = `${convId}:${payload.user_id}`;

          // Clear existing timer for this user
          const existingTimer = timersRef.current.get(key);
          if (existingTimer) clearTimeout(existingTimer);

          if (payload.is_typing) {
            setTypingMap(prev => {
              const next = new Map(prev);
              const convTyping = new Map(next.get(convId) || []);
              convTyping.set(payload.user_id, payload.user_name);
              next.set(convId, convTyping);
              return next;
            });

            // Auto-remove after 4s of no updates
            const timer = setTimeout(() => {
              setTypingMap(prev => {
                const next = new Map(prev);
                const convTyping = new Map(next.get(convId) || []);
                convTyping.delete(payload.user_id);
                if (convTyping.size === 0) {
                  next.delete(convId);
                } else {
                  next.set(convId, convTyping);
                }
                return next;
              });
              timersRef.current.delete(key);
            }, 4000);
            timersRef.current.set(key, timer);
          } else {
            setTypingMap(prev => {
              const next = new Map(prev);
              const convTyping = new Map(next.get(convId) || []);
              convTyping.delete(payload.user_id);
              if (convTyping.size === 0) {
                next.delete(convId);
              } else {
                next.set(convId, convTyping);
              }
              return next;
            });
            timersRef.current.delete(key);
          }
        })
        .subscribe();

      channelsRef.current.push(channel);
    }

    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [conversationIds.join(','), currentUserId]);

  /**
   * Get typing user names for a specific conversation.
   */
  const getTypingUsers = (conversationId: string): string[] => {
    const convTyping = typingMap.get(conversationId);
    if (!convTyping || convTyping.size === 0) return [];
    return Array.from(convTyping.values());
  };

  /**
   * Format typing indicator text for display.
   * Returns null if nobody is typing.
   */
  const getTypingText = (conversationId: string): string | null => {
    const names = getTypingUsers(conversationId);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names.length} people are typing...`;
  };

  /**
   * Check if anyone is typing in a specific conversation.
   */
  const isTyping = (conversationId: string): boolean => {
    const convTyping = typingMap.get(conversationId);
    return !!convTyping && convTyping.size > 0;
  };

  return {
    getTypingUsers,
    getTypingText,
    isTyping,
  };
};
