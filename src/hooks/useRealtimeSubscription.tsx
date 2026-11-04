import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';

interface SubscriptionConfig {
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  invalidateQueries?: string[];
}

/**
 * Centralized real-time subscription hook with automatic cleanup
 * Prevents duplicate subscriptions and memory leaks
 */
export const useRealtimeSubscription = (configs: SubscriptionConfig[]) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const configHash = JSON.stringify(configs);

  useEffect(() => {
    // Remove existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create unique channel name
    const channelName = `realtime-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelName);

    // Add all subscriptions to single channel
    configs.forEach(config => {
      const postgresConfig: any = {
        event: config.event || '*',
        schema: config.schema || 'public',
        table: config.table,
      };
      
      if (config.filter) {
        postgresConfig.filter = config.filter;
      }

      channel.on(
        'postgres_changes' as any,
        postgresConfig,
        (payload: any) => {
          // Handle specific event callbacks
          if (payload.eventType === 'INSERT' && config.onInsert) {
            config.onInsert(payload);
          }
          if (payload.eventType === 'UPDATE' && config.onUpdate) {
            config.onUpdate(payload);
          }
          if (payload.eventType === 'DELETE' && config.onDelete) {
            config.onDelete(payload);
          }

          // Invalidate queries
          if (config.invalidateQueries) {
            config.invalidateQueries.forEach(queryKey => {
              queryClient.invalidateQueries({ queryKey: [queryKey] });
            });
          }
        }
      );
    });

    // Subscribe to channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to channel: ${channelName}`);
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [configHash, queryClient]);

  return channelRef.current;
};
