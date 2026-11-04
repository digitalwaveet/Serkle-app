import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SOSAlert {
  id: string;
  user_id: string;
  sos_type: string;
  sub_category: string | null;
  urgency: string;
  description: string;
  status: string;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  share_live_location: boolean;
  photo_urls: string[] | null;
  created_at: string;
  distance?: number;
  profiles?: {
    name: string;
    avatar_url: string | null;
  };
}

interface CreateSOSAlertData {
  sos_type: string;
  sub_category?: string;
  urgency: string;
  description: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  share_live_location?: boolean;
  photo_urls?: string[];
  person_age?: string;
  person_description?: string;
  last_seen?: string;
  injury_type?: string;
  conscious_level?: string;
  threat_active?: boolean;
}

export const useSOSAlerts = (userLat?: number | null, userLng?: number | null) => {
  const queryClient = useQueryClient();

  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ['sos-alerts', userLat, userLng],
    queryFn: async () => {
      // Fetch alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('sos_alerts')
        .select('*')
        .in('status', ['active', 'responding'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (alertsError) {
        console.error('Error fetching alerts:', alertsError);
        throw alertsError;
      }

      if (!alertsData || alertsData.length === 0) {
        return [];
      }

      // Get unique user IDs
      const userIds = [...new Set(alertsData.map(alert => alert.user_id))];
      
      // Batch fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      // Create profile map for quick lookup
      const profileMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>);

      // Batch fetch helper counts
      const alertIds = alertsData.map(alert => alert.id);
      const { data: helperCounts } = await supabase
        .from('sos_helpers')
        .select('alert_id')
        .in('alert_id', alertIds)
        .in('status', ['responding', 'arrived']);

      // Count helpers per alert
      const helperCountMap = (helperCounts || []).reduce((acc, helper) => {
        acc[helper.alert_id] = (acc[helper.alert_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Process alerts with all data
      const processedAlerts = alertsData.map((alert: any) => {
        let processed = {
          ...alert,
          profiles: profileMap[alert.user_id] || null,
          helper_count: helperCountMap[alert.id] || 0
        };

        // Calculate distance if user location is available
        if (userLat && userLng && alert.location_lat && alert.location_lng) {
          const distance = calculateDistance(
            userLat,
            userLng,
            alert.location_lat,
            alert.location_lng
          );
          processed = { ...processed, distance };
        }

        return processed;
      });

      console.log('Fetched alerts:', processedAlerts.length);
      return processedAlerts;
    },
    enabled: true,
    staleTime: 10000, // Consider data fresh for 10 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const createAlert = useMutation({
    mutationFn: async (data: CreateSOSAlertData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');

      const { data: alert, error } = await supabase
        .from('sos_alerts')
        .insert({
          user_id: user.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return alert;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
      toast.success('SOS alert created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create alert: ${error.message}`);
    },
  });

  const updateAlertStatus = useMutation({
    mutationFn: async ({ alertId, status }: { alertId: string; status: string }) => {
      const { data, error } = await supabase
        .from('sos_alerts')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
    },
  });

  // Centralized real-time subscription
  useEffect(() => {
    const channel = supabase.channel('sos-realtime-all');

    // Listen to alert changes
    channel.on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'sos_alerts',
      },
      (payload: any) => {
        queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
        
        // Show in-app notifications for new alerts
        if (payload.eventType === 'INSERT' && payload.new) {
          const alert = payload.new as any;
          toast.info(`New ${alert.sos_type} alert nearby`, {
            description: alert.description?.substring(0, 50) + '...'
          });
        }
      }
    );

    // Listen to helper responses
    channel.on(
      'postgres_changes' as any,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'sos_helpers',
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['sos-helpers'] });
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Location tracking for live location sharing
  const updateAlertLocation = useCallback(async (alertId: string, lat: number, lng: number) => {
    const { error } = await supabase
      .from('sos_alerts')
      .update({
        location_lat: lat,
        location_lng: lng,
        updated_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) {
      console.error('Error updating alert location:', error);
    }
  }, []);

  return {
    alerts: alerts || [],
    isLoading,
    error,
    createAlert,
    updateAlertStatus,
    updateAlertLocation,
  };
};

// Haversine formula to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

