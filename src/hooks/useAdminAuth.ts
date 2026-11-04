import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

export const useAdminAuth = () => {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminRole, setAdminRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.session.user.id);

        if (error) {
          console.error('Error checking admin role:', error);
          setIsAdmin(false);
        } else if (data && data.length > 0) {
          const roles = data.map((r: any) => r.role);
          const hasAdmin = roles.includes('admin') || roles.includes('super_admin');
          setIsAdmin(hasAdmin);
          setAdminRole(roles.includes('super_admin') ? 'super_admin' : roles.includes('admin') ? 'admin' : roles[0]);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Admin auth check failed:', err);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdmin();
  }, [user]);

  return { isAdmin, isLoading, adminRole };
};
