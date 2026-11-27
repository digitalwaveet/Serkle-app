import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { parseAdminSnapshot } from '@/lib/adminSnapshot';

export const useAdminSnapshot = () => {
  const { session } = useUser();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['admin', 'snapshot', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    networkMode: 'always',
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_admin_operational_snapshot').abortSignal(signal);
      if (error) throw error;
      return parseAdminSnapshot(data);
    },
  });
};
