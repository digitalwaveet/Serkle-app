import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HelperRequest {
  id: string;
  alert_id: string;
  helper_id: string;
  requester_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  estimated_arrival_minutes?: number;
  request_message?: string;
  created_at: string;
  responded_at?: string;
}

export const useHelperRequests = (alertId?: string) => {
  const queryClient = useQueryClient();

  // Fetch requests for a specific alert (requester view)
  const { data: sentRequests, isLoading: isLoadingSent } = useQuery({
    queryKey: ['helper-requests-sent', alertId],
    queryFn: async () => {
      if (!alertId) return [];
      
      const { data, error } = await supabase
        .from('helper_requests')
        .select('*')
        .eq('alert_id', alertId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!alertId,
  });

  // Fetch incoming requests for current user (helper view)
  const { data: incomingRequests, isLoading: isLoadingIncoming } = useQuery({
    queryKey: ['helper-requests-incoming'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: requests, error } = await supabase
        .from('helper_requests')
        .select('*')
        .eq('helper_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch related data manually
      const enrichedRequests = await Promise.all(
        (requests || []).map(async (request) => {
          const { data: alert } = await supabase
            .from('sos_alerts')
            .select('id, sos_type, urgency, description, location_lat, location_lng, location_address')
            .eq('id', request.alert_id)
            .single();

          const { data: profile } = await supabase
            .from('profiles')
            .select('name, avatar_url, initials, avatar_color')
            .eq('id', request.requester_id)
            .single();

          return {
            ...request,
            sos_alerts: alert,
            profiles: profile,
          };
        })
      );

      return enrichedRequests;
    },
    // Removed refetchInterval: 5000 — realtime subscription below handles updates
    staleTime: 30000,
  });

  // Send request to a specific helper
  const sendRequest = useMutation({
    mutationFn: async ({
      alertId,
      helperId,
      message,
    }: {
      alertId: string;
      helperId: string;
      message?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if request already exists
      const { data: existing } = await supabase
        .from('helper_requests')
        .select('id')
        .eq('alert_id', alertId)
        .eq('helper_id', helperId)
        .eq('status', 'pending')
        .single();

      if (existing) {
        throw new Error('Request already sent to this helper');
      }

      const { data, error } = await supabase
        .from('helper_requests')
        .insert({
          alert_id: alertId,
          helper_id: helperId,
          requester_id: user.id,
          request_message: message,
        })
        .select()
        .single();

      if (error) throw error;

      // Call edge function to send push notification
      await supabase.functions.invoke('notify-helper-request', {
        body: { requestId: data.id, helperId },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-requests-sent'] });
      toast.success('Request sent to helper');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Respond to a request (helper accepts/declines)
  const respondToRequest = useMutation({
    mutationFn: async ({
      requestId,
      status,
      estimatedArrival,
    }: {
      requestId: string;
      status: 'accepted' | 'declined';
      estimatedArrival?: number;
    }) => {
      const { data, error } = await supabase
        .from('helper_requests')
        .update({
          status,
          responded_at: new Date().toISOString(),
          estimated_arrival_minutes: estimatedArrival,
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['helper-requests-incoming'] });
      if (variables.status === 'accepted') {
        toast.success('Request accepted! Navigating to alert...');
      } else {
        toast.info('Request declined');
      }
    },
  });

  // Realtime subscription for incoming requests
  useEffect(() => {
    const channel = supabase
      .channel('helper-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'helper_requests',
        },
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && payload.new.helper_id === user.id) {
            queryClient.invalidateQueries({ queryKey: ['helper-requests-incoming'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'helper_requests',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['helper-requests-sent'] });
          queryClient.invalidateQueries({ queryKey: ['helper-requests-incoming'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    sentRequests,
    incomingRequests,
    isLoadingSent,
    isLoadingIncoming,
    sendRequest,
    respondToRequest,
  };
};
