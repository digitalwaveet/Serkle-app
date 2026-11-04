import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HelperResponse {
  alert_id: string;
  estimated_arrival_minutes?: number;
  current_lat?: number;
  current_lng?: number;
}

export const useSOSHelpers = (alertId?: string) => {
  const queryClient = useQueryClient();

  const { data: helpers, isLoading } = useQuery({
    queryKey: ['sos-helpers', alertId],
    queryFn: async () => {
      if (!alertId) return [];

      const { data, error } = await supabase
        .from('sos_helpers')
        .select(`
          *,
          profiles:helper_user_id (name, avatar_url)
        `)
        .eq('alert_id', alertId)
        .order('accepted_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!alertId,
  });

  // Check if current user has already responded to an alert
  const checkExistingResponse = async (alertId: string, userId: string) => {
    const { data } = await supabase
      .from('sos_helpers')
      .select('id')
      .eq('alert_id', alertId)
      .eq('helper_user_id', userId)
      .single();
    
    return !!data;
  };

  const respondToAlert = useMutation({
    mutationFn: async (data: HelperResponse) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');

      // Check if user has already responded
      const hasResponded = await checkExistingResponse(data.alert_id, user.id);
      if (hasResponded) {
        throw new Error('You have already responded to this alert');
      }

      const { data: helper, error } = await supabase
        .from('sos_helpers')
        .insert({
          alert_id: data.alert_id,
          helper_user_id: user.id,
          estimated_arrival_minutes: data.estimated_arrival_minutes,
          current_lat: data.current_lat,
          current_lng: data.current_lng,
        })
        .select()
        .single();

      if (error) throw error;
      return helper;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-helpers'] });
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['helper-profile'] });
    },
    onError: (error: Error) => {
      // Errors are handled by caller with custom toasts
      console.error('Failed to respond:', error);
    },
  });

  const updateHelperLocation = useMutation({
    mutationFn: async ({ 
      helperId, 
      lat, 
      lng 
    }: { 
      helperId: string; 
      lat: number; 
      lng: number;
    }) => {
      const { data, error } = await supabase
        .from('sos_helpers')
        .update({
          current_lat: lat,
          current_lng: lng,
        })
        .eq('id', helperId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });

  const completeHelp = useMutation({
    mutationFn: async ({ alertId, helperId }: { alertId: string; helperId: string }) => {
      const { error } = await supabase
        .from('sos_helpers')
        .update({ 
          completed_at: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', helperId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-helpers'] });
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
      toast.success('Help marked as completed');
    },
    onError: (error) => {
      console.error('Error completing help:', error);
      toast.error('Failed to mark help as completed');
    },
  });

  const markAsArrived = useMutation({
    mutationFn: async ({ helperId }: { helperId: string }) => {
      const { error } = await supabase
        .from('sos_helpers')
        .update({ 
          arrived_at: new Date().toISOString(),
          status: 'arrived'
        })
        .eq('id', helperId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-helpers'] });
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
      toast.success('Marked as arrived at scene');
    },
    onError: (error) => {
      console.error('Error marking as arrived:', error);
      toast.error('Failed to update status');
    },
  });

  const updateHelperStatus = useMutation({
    mutationFn: async ({ helperId, status }: { helperId: string; status: string }) => {
      const { error } = await supabase
        .from('sos_helpers')
        .update({ status })
        .eq('id', helperId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-helpers'] });
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
    },
    onError: (error) => {
      console.error('Error updating helper status:', error);
      toast.error('Failed to update status');
    },
  });

  // Centralized realtime subscription  
  useEffect(() => {
    const channel = supabase.channel('sos-helpers-realtime');

    channel.on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'sos_helpers',
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['sos-helpers'] });
        queryClient.invalidateQueries({ queryKey: ['helper-profile'] });
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const cancelResponse = useMutation({
    mutationFn: async ({ helperId }: { helperId: string }) => {
      const { error } = await supabase
        .from('sos_helpers')
        .delete()
        .eq('id', helperId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-helpers'] });
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['helper-profile'] });
      toast.success('Response cancelled');
    },
    onError: (error) => {
      console.error('Error cancelling response:', error);
      toast.error('Failed to cancel response');
    },
  });

  return {
    helpers: helpers || [],
    isLoading,
    respondToAlert,
    updateHelperLocation,
    completeHelp,
    markAsArrived,
    updateHelperStatus,
    checkExistingResponse,
    cancelResponse,
  };
};
