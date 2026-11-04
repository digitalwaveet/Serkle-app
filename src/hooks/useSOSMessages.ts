import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type SOSMessage = Database['public']['Tables']['sos_messages']['Row'];

export const useSOSMessages = (alertId?: string) => {
  const queryClient = useQueryClient();

  // Fetch messages for an alert
  const { data: messages, isLoading } = useQuery({
    queryKey: ['sos-messages', alertId],
    queryFn: async () => {
      if (!alertId) return [];

      const { data, error } = await supabase
        .from('sos_messages')
        .select('*')
        .eq('alert_id', alertId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles separately for each message
      const messagesWithProfiles = await Promise.all(
        data.map(async (message: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, avatar_color, initials')
            .eq('id', message.sender_id)
            .single();
          
          return { ...message, profiles: profile };
        })
      );

      return messagesWithProfiles;
    },
    enabled: !!alertId,
  });

  // Send a message
  const sendMessage = useMutation({
    mutationFn: async ({ 
      alertId, 
      messageText 
    }: { 
      alertId: string; 
      messageText: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sos_messages')
        .insert({
          alert_id: alertId,
          sender_id: user.id,
          message_text: messageText,
          is_system_message: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-messages'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });

  // Send system message
  const sendSystemMessage = useMutation({
    mutationFn: async ({ 
      alertId, 
      messageText 
    }: { 
      alertId: string; 
      messageText: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sos_messages')
        .insert({
          alert_id: alertId,
          sender_id: user.id,
          message_text: messageText,
          is_system_message: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-messages'] });
    },
  });

  // Set up realtime subscription for messages
  useEffect(() => {
    if (!alertId) return;

    const channel = supabase
      .channel(`sos_messages_${alertId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sos_messages',
          filter: `alert_id=eq.${alertId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sos-messages', alertId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alertId, queryClient]);

  return {
    messages: messages || [],
    isLoading,
    sendMessage,
    sendSystemMessage,
  };
};
