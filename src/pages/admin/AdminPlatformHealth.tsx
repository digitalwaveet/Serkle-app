import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/contexts/UserContext';
import { useAdminSnapshot } from '@/hooks/useAdminSnapshot';
import { supabase } from '@/integrations/supabase/client';

const unchecked = [
  'Realtime updates', 'Storage and media', 'Edge Functions', 'Email and SMS delivery',
  'Push delivery', 'Payment provider and webhooks', 'Maps and location services', 'Live video delivery',
];

function CheckRow({ label, status, detail }: {
  label: string;
  status: 'Passed' | 'Unavailable' | 'Checking' | 'Not checked';
  detail?: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>}
      </div>
      <Badge variant={status === 'Unavailable' ? 'destructive' : 'outline'}>{status}</Badge>
    </li>
  );
}

export default function AdminPlatformHealth() {
  const { session } = useUser();
  const userId = session?.user.id;
  const snapshot = useAdminSnapshot();
  const auth = useQuery({
    queryKey: ['admin', 'auth-check', userId],
    enabled: Boolean(userId),
    gcTime: 0,
    retry: false,
    networkMode: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (data.user?.id !== userId) throw new Error('Session could not be verified');
      return Date.now();
    },
  });
  const checking = snapshot.isFetching || auth.isFetching;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Platform health</h1>
          <p className="text-sm text-muted-foreground">Results from requests made by this admin session.</p>
        </div>
        <Button variant="outline" size="sm" disabled={checking} onClick={() => {
          void snapshot.refetch();
          void auth.refetch();
        }}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {checking ? 'Checking…' : 'Run checks'}
        </Button>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-lg">Session checks</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y" aria-live="polite">
            <CheckRow
              label="Admin database request"
              status={snapshot.isFetching ? 'Checking' : snapshot.isSuccess ? 'Passed' : 'Unavailable'}
              detail={snapshot.isSuccess
                ? `Operations data returned at ${snapshot.data.checkedAt.toLocaleString()}`
                : snapshot.isError ? 'The operations data request failed.' : undefined}
            />
            <CheckRow
              label="Authentication session"
              status={auth.isFetching ? 'Checking' : auth.isSuccess ? 'Passed' : 'Unavailable'}
              detail={auth.isSuccess ? `Account verified at ${new Date(auth.data).toLocaleString()}`
                : auth.isError ? 'The current account could not be verified.' : undefined}
            />
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Service monitoring coverage</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {unchecked.map((label) => <CheckRow key={label} label={label} status="Not checked" />)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
