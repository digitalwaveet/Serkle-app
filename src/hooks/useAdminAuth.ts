import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

type AdminRole = 'admin' | 'super_admin';

export const useAdminAuth = () => {
  const { session, isSessionReady } = useUser();
  const userId = session?.user.id;
  const role = useQuery({
    queryKey: ['admin', 'role', userId],
    enabled: Boolean(userId),
    gcTime: 0,
    staleTime: 20_000,
    networkMode: 'always',
    retry: false,
    refetchOnWindowFocus: 'always',
    refetchInterval: 30_000,
    queryFn: async ({ signal }): Promise<AdminRole | null> => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId!)
        .in('role', ['admin', 'super_admin'])
        .abortSignal(signal);

      if (error) throw error;
      if (data.some((entry) => entry.role === 'super_admin')) return 'super_admin';
      return data.some((entry) => entry.role === 'admin') ? 'admin' : null;
    },
  });

  if (!userId) {
    return { status: isSessionReady ? 'anonymous' : 'loading', adminRole: null } as const;
  }
  if (role.isPending) return { status: 'loading', adminRole: null } as const;
  if (role.isError) {
    return { status: 'unavailable', adminRole: null, retry: role.refetch, isRetrying: role.isFetching } as const;
  }
  if (role.data) return { status: 'allowed', adminRole: role.data } as const;
  return { status: 'denied', adminRole: null } as const;
};
