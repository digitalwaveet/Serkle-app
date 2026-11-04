import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TypingPayload {
  user_id: string;
  user_name: string;
  is_typing: boolean;
}

export const useTypingIndicator = (
  conversationId: string | undefined,
  currentUserId: string | undefined,
  currentUserName: string | undefined
) => {
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const typingChannel = supabase.channel(`typing:${conversationId}`);

    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: TypingPayload }) => {
        if (payload.user_id === currentUserId) return;

        const existingTimer = typingTimers.current.get(payload.user_id);
        if (existingTimer) {
          clearTimeout(existingTimer);
          typingTimers.current.delete(payload.user_id);
        }

        if (payload.is_typing) {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.set(payload.user_id, payload.user_name);
            return newMap;
          });

          // Auto-remove after 3 seconds of no updates
          const timer = setTimeout(() => {
            setTypingUsers(prev => {
              const newMap = new Map(prev);
              newMap.delete(payload.user_id);
              return newMap;
            });
            typingTimers.current.delete(payload.user_id);
          }, 3000);
          typingTimers.current.set(payload.user_id, timer);
        } else {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(payload.user_id);
            return newMap;
          });
        }
      })
      .subscribe();

    setChannel(typingChannel);

    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimers.current.forEach(timer => clearTimeout(timer));
      typingTimers.current.clear();
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, currentUserId]);

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!channel || !currentUserId || !currentUserName) return;

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: currentUserId,
        user_name: currentUserName,
        is_typing: isTyping,
      },
    });
  }, [channel, currentUserId, currentUserName]);

  const startTyping = useCallback(() => {
    sendTypingIndicator(true);

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const timeout = setTimeout(() => {
      sendTypingIndicator(false);
    }, 2000);

    setTypingTimeout(timeout);
  }, [sendTypingIndicator, typingTimeout]);

  const stopTyping = useCallback(() => {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
    sendTypingIndicator(false);
  }, [sendTypingIndicator, typingTimeout]);

  const typingUserNames = Array.from(typingUsers.values());

  return {
    typingUsers: typingUserNames,
    startTyping,
    stopTyping,
  };
};
