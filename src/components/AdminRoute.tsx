import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const access = useAdminAuth();

  if (access.status === 'anonymous') return <Navigate to="/login" replace />;
  if (access.status === 'allowed') return <>{children}</>;

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      {access.status === 'loading' ? (
        <SerkleLoader label="Verifying admin access" showText />
      ) : (
        <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-card-foreground">
          <h1 className="text-xl font-semibold">
            {access.status === 'denied' ? 'Admin access required' : 'Could not verify admin access'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {access.status === 'denied'
              ? 'This account does not have access to the admin panel.'
              : 'Retry the access check to open the admin panel.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {access.status === 'unavailable' && (
              <Button onClick={() => void access.retry()} disabled={access.isRetrying}>
                {access.isRetrying ? 'Checking…' : 'Retry'}
              </Button>
            )}
            <Button asChild variant="outline"><Link to="/">Back to Serkle</Link></Button>
          </div>
        </div>
      )}
    </main>
  );
};

export default AdminRoute;
