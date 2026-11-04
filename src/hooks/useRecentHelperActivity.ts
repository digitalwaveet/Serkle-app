import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRecentHelperActivity = (userId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['helper-recent-activity', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('sos_helpers')
        .select(`
          id,
          status,
          completed_at,
          accepted_at,
          alert_id,
          sos_alerts:alert_id (
            sos_type,
            description,
            location_address,
            urgency
          )
        `)
        .eq('helper_user_id', userId)
        .order('accepted_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return data.map((activity: any) => ({
        id: activity.id,
        action: activity.status === 'completed' 
          ? `Helped with ${activity.sos_alerts?.sos_type || 'emergency'}`
          : `Responding to ${activity.sos_alerts?.sos_type || 'emergency'}`,
        time: activity.completed_at || activity.accepted_at,
        location: activity.sos_alerts?.location_address || 'Location unavailable',
        type: activity.sos_alerts?.sos_type || 'other',
        urgency: activity.sos_alerts?.urgency || 'medium',
        status: activity.status,
      }));
    },
    enabled: !!userId,
  });

  // Set up realtime subscription for sos_helpers updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('helper_activity_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sos_helpers',
          filter: `helper_user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['helper-recent-activity', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
};
