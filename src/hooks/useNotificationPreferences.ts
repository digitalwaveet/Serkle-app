import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NotificationPreferences {
  id?: string;
  user_id: string;
  enabled: boolean;
  sos_alerts: boolean;
  helper_responses: boolean;
  alert_updates: boolean;
  emergency_contact_alerts: boolean;
  max_distance_km: number;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  // App-level category toggles (persisted in localStorage)
  social_likes?: boolean;
  social_comments?: boolean;
  social_follows?: boolean;
  social_mentions?: boolean;
  circles_posts?: boolean;
  circles_members?: boolean;
  circles_events?: boolean;
  shop_orders?: boolean;
  shop_shipping?: boolean;
  shop_disputes?: boolean;
  messages_direct?: boolean;
  messages_groups?: boolean;
  sound_enabled?: boolean;
  in_app_toasts?: boolean;
}

const LOCAL_STORAGE_KEY = 'serkle_notification_preferences';

const DEFAULT_LOCAL_PREFS = {
  social_likes: true,
  social_comments: true,
  social_follows: true,
  social_mentions: true,
  circles_posts: true,
  circles_members: true,
  circles_events: true,
  shop_orders: true,
  shop_shipping: true,
  shop_disputes: true,
  messages_direct: true,
  messages_groups: true,
  sound_enabled: true,
  in_app_toasts: true,
};

function getLocalPrefs() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return { ...DEFAULT_LOCAL_PREFS, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Error reading local notification prefs', e);
  }
  return DEFAULT_LOCAL_PREFS;
}

export const useNotificationPreferences = (userId?: string) => {
  const queryClient = useQueryClient();
  const [localPrefs, setLocalPrefs] = useState(getLocalPrefs);

  useEffect(() => {
    const handleStorage = () => setLocalPrefs(getLocalPrefs());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const { data: dbPrefs, isLoading } = useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || {
        user_id: userId,
        enabled: true,
        sos_alerts: true,
        helper_responses: true,
        alert_updates: true,
        emergency_contact_alerts: true,
        max_distance_km: 10,
        quiet_hours_start: null,
        quiet_hours_end: null,
      };
    },
    enabled: !!userId,
  });

  const updatePreferences = useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      // Split into DB prefs and local prefs
      const dbKeys = [
        'enabled', 'sos_alerts', 'helper_responses', 'alert_updates',
        'emergency_contact_alerts', 'max_distance_km',
        'quiet_hours_start', 'quiet_hours_end'
      ];

      const dbUpdate: Record<string, any> = {};
      const newLocal: Record<string, any> = { ...localPrefs };
      let hasLocalChanges = false;

      Object.entries(prefs).forEach(([key, val]) => {
        if (dbKeys.includes(key)) {
          dbUpdate[key] = val;
        } else if (key in DEFAULT_LOCAL_PREFS) {
          newLocal[key] = val;
          hasLocalChanges = true;
        }
      });

      if (hasLocalChanges) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newLocal));
        setLocalPrefs(newLocal);
      }

      if (userId && Object.keys(dbUpdate).length > 0) {
        const { data, error } = await supabase
          .from('notification_preferences')
          .upsert({
            user_id: userId,
            ...dbUpdate,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferences updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update preferences: ${error.message}`);
    },
  });

  const mergedPreferences: NotificationPreferences | null = userId ? {
    user_id: userId,
    enabled: dbPrefs?.enabled ?? true,
    sos_alerts: dbPrefs?.sos_alerts ?? true,
    helper_responses: dbPrefs?.helper_responses ?? true,
    alert_updates: dbPrefs?.alert_updates ?? true,
    emergency_contact_alerts: dbPrefs?.emergency_contact_alerts ?? true,
    max_distance_km: dbPrefs?.max_distance_km ?? 10,
    quiet_hours_start: dbPrefs?.quiet_hours_start ?? null,
    quiet_hours_end: dbPrefs?.quiet_hours_end ?? null,
    ...localPrefs,
  } : null;

  return {
    preferences: mergedPreferences,
    isLoading,
    updatePreferences,
  };
};
