import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLiveMutations } from './useLiveMutations';

interface LiveStream {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: 'random' | 'circle';
  circle_id?: string;
  viewer_count: number;
  status: 'live' | 'ended';
  started_at: string;
  profiles: {
    username: string;
    name: string;
    avatar_url: string;
  };
  circles?: {
    name: string;
  };
}

interface LiveMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles: {
    username: string;
    name: string;
  };
}

export const useLiveStream = (streamId: string | null) => {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const { joinStream, leaveStream, sendMessage } = useLiveMutations();

  // Fetch stream details
  const { data: stream, isLoading } = useQuery({
    queryKey: ['live-stream', streamId],
    queryFn: async () => {
      if (!streamId) return null;
      const { data } = await (supabase as any)
        .from('live_streams')
        .select(`
          *,
          profiles:user_id (
            username,
            name,
            avatar_url
          ),
          circles:circle_id (
            name
          )
        `)
        .eq('id', streamId)
        .maybeSingle();
      return data as LiveStream | null;
    },
    enabled: !!streamId,
    refetchInterval: 5000
  });

  // Join stream on mount
  useEffect(() => {
    if (streamId) {
      joinStream(streamId);
      return () => {
        leaveStream(streamId);
      };
    }
  }, [streamId]);

  // Real-time messages subscription
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`live-messages-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_messages',
          filter: `stream_id=eq.${streamId}`
        },
        async (payload) => {
          const { data: profile } = await (supabase as any)
            .from('profiles')
            .select('username, name')
            .eq('id', (payload.new as any).user_id)
            .maybeSingle();

          const newMessage: LiveMessage = {
            ...payload.new as any,
            profiles: profile || { username: 'User', name: 'User' }
          };
          
          setMessages(prev => [...prev, newMessage].slice(-50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Real-time viewer count updates
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`live-viewers-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_viewers',
          filter: `stream_id=eq.${streamId}`
        },
        () => {
          // Refetch stream data to get updated viewer count
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const handleSendMessage = async (message: string) => {
    if (!streamId || !message.trim()) return;
    await sendMessage(streamId, message);
  };

  return {
    stream,
    messages,
    isLoading,
    sendMessage: handleSendMessage
  };
};
