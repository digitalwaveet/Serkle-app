import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMapboxToken = () => {
  return useQuery({
    queryKey: ['mapbox-token'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (error) {
        console.error('Mapbox token error:', error);
        throw new Error('Failed to fetch Mapbox token');
      }
      
      if (!data?.token) {
        throw new Error('No Mapbox token received');
      }
      
      return data.token as string;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
};
