import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { CIRCLE_ACCESS_QUERY_KEYS } from '@/lib/circlePayments';

export const useCircleSubscription = (circleId: string | undefined) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const query = useQuery({
    queryKey: ['circle-subscription', circleId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_circle_subscription' as any, { _circle_id: circleId });
      if (error) throw error;
      return data as any;
    },
    enabled: !!circleId && !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 15000,
  });
  const expiresAt = query.data?.expires_at ? Date.parse(query.data.expires_at) : null;
  useEffect(() => {
    if (expiresAt === null || !Number.isFinite(expiresAt)) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
      CIRCLE_ACCESS_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    }, Math.min(delay + 1, 2147483647));
    return () => clearTimeout(timer);
  }, [expiresAt, queryClient, now]);
  return { ...query, data: !user || query.isError || (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Math.max(now, Date.now()))) ? null : query.data };
};
