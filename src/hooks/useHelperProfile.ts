import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type HelperProfile = Database['public']['Tables']['helper_profiles']['Row'];
type HelperProfileInsert = Database['public']['Tables']['helper_profiles']['Insert'];
type HelperProfileUpdate = Database['public']['Tables']['helper_profiles']['Update'];

export const useHelperProfile = (userId?: string) => {
  const queryClient = useQueryClient();

  // Fetch helper profile
  const { data: helperProfile, isLoading } = useQuery({
    queryKey: ['helper-profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('helper_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Create or update helper profile
  const upsertProfile = useMutation({
    mutationFn: async (profileData: HelperProfileUpdate) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('helper_profiles')
        .upsert({
          user_id: user.id,
          ...profileData,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-profile'] });
      toast.success('Helper profile updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });

  // Update availability status
  const updateAvailability = useMutation({
    mutationFn: async ({ 
      status, 
      isAvailable 
    }: { 
      status: string; 
      isAvailable: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('helper_profiles')
        .upsert({
          user_id: user.id,
          availability_status: status,
          is_available: isAvailable,
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-profile'] });
      toast.success('Availability updated');
    },
  });

  // Update location
  const updateLocation = useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('helper_profiles')
        .upsert({
          user_id: user.id,
          location_lat: lat,
          location_lng: lng,
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-profile'] });
    },
  });

  // Update skills
  const updateSkills = useMutation({
    mutationFn: async (skills: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('helper_profiles')
        .upsert({
          user_id: user.id,
          skills: skills,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-profile'] });
      toast.success('Skills updated');
    },
  });

  // Fetch helper's active responses
  const { data: activeResponses } = useQuery({
    queryKey: ['helper-active-responses', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('sos_helpers')
        .select(`
          *,
          sos_alerts (
            *,
            profiles:user_id (name, avatar_url, initials, avatar_color)
          )
        `)
        .eq('helper_user_id', userId)
        .in('status', ['responding', 'arrived'])
        .order('accepted_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch helper's completed responses
  const { data: completedResponses } = useQuery({
    queryKey: ['helper-completed-responses', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('sos_helpers')
        .select(`
          *,
          sos_alerts (
            sos_type,
            created_at,
            resolved_at
          ),
          sos_reviews (
            rating,
            review_text
          )
        `)
        .eq('helper_user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('helper_profile_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'helper_profiles',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['helper-profile', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return {
    helperProfile,
    isLoading,
    activeResponses: activeResponses || [],
    completedResponses: completedResponses || [],
    upsertProfile,
    updateAvailability,
    updateLocation,
    updateSkills,
  };
};
