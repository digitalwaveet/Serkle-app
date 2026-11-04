import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useNotifications = () => {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, error } = useQuery({
    queryKey: ['push-notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('push_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    staleTime: 5000,
    retry: 2,
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('push_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-notifications'] });
    },
  });

  const markConversationNotificationsAsRead = useMutation({
    mutationFn: async (conversationId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('push_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null)
        .filter('data->>conversation_id', 'eq', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('push_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-notifications'] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationIds: string | string[]) => {
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
      const { error } = await supabase
        .from('push_notifications')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-notifications'] });
    },
  });

  const clearAllNotifications = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('push_notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-notifications'] });
    },
  });

  // Realtime is handled globally by GlobalRealtimeListener

  const unreadCount = notifications?.filter(n => !n.read_at).length || 0;

  return {
    notifications: notifications || [],
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    markConversationNotificationsAsRead,
    error,
  };
};
