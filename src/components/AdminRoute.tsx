import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, isLoading: userLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsChecking(false);
        return;
      }

      try {
        // Use the existing has_role RPC function
        const { data, error } = await supabase.rpc('has_role', {
          _role: 'admin',
        });

        if (error) {
          console.error('Error checking admin role:', error);
          // Fallback: check profiles.role field
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          setIsAdmin(profile?.role === 'admin' || profile?.role === 'super_admin');
        } else {
          setIsAdmin(data === true);
        }
      } catch (err) {
        console.error('Admin check failed:', err);
        setIsAdmin(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAdminRole();
  }, [user]);

  // Still loading user auth
  if (userLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <SerkleLoader size="md" className="text-current" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Not admin
  if (!isAdmin) {
    toast({
      title: "Access Denied",
      description: "You don't have permission to access the admin panel.",
      variant: "destructive",
    });
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
