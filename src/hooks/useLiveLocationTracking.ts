import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
}

interface UseLiveLocationTrackingProps {
  alertId?: string;
  isHelper?: boolean;
  enabled?: boolean;
}

export const useLiveLocationTracking = ({ 
  alertId, 
  isHelper = false, 
  enabled = true 
}: UseLiveLocationTrackingProps = {}) => {
  const [location, setLocation] = useState<LocationUpdate | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const { toast } = useToast();

  const updateLocationInDB = useCallback(async (lat: number, lng: number, accuracy?: number) => {
    if (!alertId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isHelper) {
        // Update helper location
        const { error } = await supabase
          .from('sos_helpers')
          .update({
            current_lat: lat,
            current_lng: lng,
          })
          .eq('alert_id', alertId)
          .eq('helper_user_id', user.id);

        if (error) throw error;
      } else {
        // Update alert location
        const { error } = await supabase
          .from('sos_alerts')
          .update({
            location_lat: lat,
            location_lng: lng,
          })
          .eq('id', alertId)
          .eq('user_id', user.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  }, [alertId, isHelper]);

  const startTracking = useCallback(() => {
    if (!enabled || !navigator.geolocation) {
      toast({
        title: "Location not available",
        description: "Your device doesn't support location tracking",
        variant: "destructive",
      });
      return;
    }

    setIsTracking(true);

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(),
        };
        
        setLocation(newLocation);
        
        // Update database every position change
        updateLocationInDB(
          newLocation.latitude, 
          newLocation.longitude, 
          newLocation.accuracy
        );
      },
      (error) => {
        console.error('Location tracking error:', error);
        toast({
          title: "Location tracking failed",
          description: error.message,
          variant: "destructive",
        });
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    setWatchId(id);
  }, [enabled, toast, updateLocationInDB]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  }, [watchId]);

  useEffect(() => {
    if (enabled && alertId) {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, alertId]);

  return {
    location,
    isTracking,
    startTracking,
    stopTracking,
  };
};
