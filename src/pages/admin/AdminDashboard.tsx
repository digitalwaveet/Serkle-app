import { ArrowRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminSnapshot } from '@/hooks/useAdminSnapshot';
import type { AdminSnapshot } from '@/lib/adminSnapshot';

type Metric = { key: keyof AdminSnapshot['counts']; label: string; path?: string };

const reviewMetrics: Metric[] = [
  { key: 'active_sos', label: 'Active SOS alerts', path: 'safety' },
  { key: 'pending_reports', label: 'Pending reports', path: 'reports' },
  { key: 'pending_reviews', label: 'Pending content reviews', path: 'content-queue' },
  { key: 'pending_appeals', label: 'Pending appeals', path: 'appeals' },
  { key: 'open_disputes', label: 'Open shop disputes', path: 'shop' },
  { key: 'live_streams', label: 'Live streams on air', path: 'live-streams' },
];

const activityMetrics: Metric[] = [
  { key: 'profiles', label: 'Profiles', path: 'users' },
  { key: 'banned_profiles', label: 'Banned profiles', path: 'users' },
  { key: 'posts', label: 'Posts', path: 'posts' },
  { key: 'stories', label: 'Stories' },
  { key: 'videos', label: 'Videos', path: 'videos' },
  { key: 'comments', label: 'Comments', path: 'comments' },
  { key: 'circles', label: 'Circles', path: 'circles' },
  { key: 'questions', label: 'Ask questions', path: 'ask-moderation' },
  { key: 'messages', label: 'Message records' },
  { key: 'orders', label: 'Shop orders', path: 'shop' },
];

const signupDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

function Metrics({ title, metrics, counts }: { title: string; metrics: Metric[]; counts: AdminSnapshot['counts'] }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {metrics.map(({ key, label, path }) => {
          const content = (
            <>
              <span className="block text-2xl font-semibold tabular-nums">{counts[key].toLocaleString()}</span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                {label}
                {path && <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              </span>
            </>
          );
          return (
            <li key={key} className="rounded-xl border bg-card text-card-foreground">
              {path ? (
                <Link to={`/admin/${path}`} className="block h-full rounded-xl p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {content}
                </Link>
              ) : <div className="p-4">{content}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function AdminDashboard() {
  const snapshot = useAdminSnapshot();
  const data = snapshot.isSuccess ? snapshot.data : undefined;
  const peak = Math.max(1, ...(data?.signups.map(({ count }) => count) ?? []));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Operations dashboard</h1>
          {data && <p className="text-sm text-muted-foreground">Updated {data.checkedAt.toLocaleString()}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/admin/platform-health">Platform health</Link></Button>
          <Button variant="outline" size="sm" disabled={snapshot.isFetching} onClick={() => void snapshot.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {snapshot.isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </header>

      {snapshot.isPending && <SerkleLoader label="Loading operations data" showText />}
      {snapshot.isError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">Operations data unavailable</p>
          <p className="mt-1 text-muted-foreground">The admin data request failed. Refresh to try again.</p>
        </div>
      )}

      {data && (
        <>
          <Metrics title="Review and response" metrics={reviewMetrics} counts={data.counts} />
          <Metrics title="Platform records" metrics={activityMetrics} counts={data.counts} />
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">New profiles</CardTitle>
              <p className="text-sm text-muted-foreground">Last seven calendar days in UTC</p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                {data.signups.map(({ day, count }) => (
                  <div key={day} className="grid grid-cols-[minmax(5rem,auto)_1fr] items-center gap-3 text-sm">
                    <dt className="text-muted-foreground">{signupDate.format(new Date(day))}</dt>
                    <dd className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <div className="h-2 min-w-0 rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(count / peak) * 100}%` }} />
                      </div>
                      <span className="min-w-8 text-right font-medium tabular-nums">{count.toLocaleString()}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
