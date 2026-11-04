import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';

export interface CircleMessage {
  id: string;
  circle_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    name: string;
    username: string;
    avatar_url: string | null;
    initials: string;
    avatar_color: string;
  };
}

export const useCircleMessages = (circleId: string | undefined, isOwner: boolean) => {
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ['circle-messages', circleId],
    queryFn: async () => {
      if (!circleId) return [];

      const { data, error } = await supabase
        .from('circle_messages')
        .select('*')
        .eq('circle_id', circleId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data?.length) return [];

      // Fetch sender profiles
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, initials, avatar_color')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id) || undefined,
      })) as CircleMessage[];
    },
    enabled: !!circleId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!circleId) return;
    const channel = supabase
      .channel(`circle-messages:${circleId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'circle_messages',
        filter: `circle_id=eq.${circleId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['circle-messages', circleId] });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'circle_messages',
        filter: `circle_id=eq.${circleId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['circle-messages', circleId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [circleId, queryClient]);

  const unreadCount = (messages || []).filter(m => !m.is_read).length;

  return { messages: messages || [], isLoading, unreadCount };
};

export const useSendCircleMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ circleId, senderId, content }: {
      circleId: string;
      senderId: string;
      content: string;
    }) => {
      // Ensure we have a valid session before sending
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Try to refresh the session
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (!refreshData.session) {
          throw new Error('Not authenticated. Please log in again.');
        }
      }

      const { data, error } = await supabase
        .from('circle_messages')
        .insert({ circle_id: circleId, sender_id: senderId, content })
        .select()
        .single();
      if (error) {
        console.error('Circle message insert error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['circle-messages', vars.circleId] });
    },
    onError: (error: any) => {
      console.error('Send circle message error:', error);
      if (error?.code === '42501' || error?.message?.includes('row-level security')) {
        toast.error('Please log out and log back in to send messages.');
      } else {
        toast.error(error?.message || 'Failed to send message');
      }
    },
  });
};

export const useMarkCircleMessagesRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ circleId, messageIds }: { circleId: string; messageIds: string[] }) => {
      const { error } = await supabase
        .from('circle_messages')
        .update({ is_read: true })
        .in('id', messageIds);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['circle-messages', vars.circleId] });
    },
  });
};
