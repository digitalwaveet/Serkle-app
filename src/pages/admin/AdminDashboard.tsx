import { ArrowUpRight, CircleDot, ClipboardList, FileText, Flag, HeartPulse, Radio, RefreshCw, Scale, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAdminSnapshot } from '@/hooks/useAdminSnapshot';
import type { AdminSnapshot } from '@/lib/adminSnapshot';

type Metric = { key: keyof AdminSnapshot['counts']; label: string; path?: string };
const work: (Metric & { icon: LucideIcon })[] = [
  { key: 'pending_reports', label: 'Pending reports', path: 'reports', icon: Flag },
  { key: 'pending_reviews', label: 'Content reviews', path: 'content-queue', icon: ClipboardList },
  { key: 'pending_appeals', label: 'Pending appeals', path: 'appeals', icon: Scale },
  { key: 'live_streams', label: 'Live streams on air', path: 'live-streams', icon: Radio },
];
const records: Metric[] = [
  { key: 'profiles', label: 'Profiles', path: 'users' },
  { key: 'banned_profiles', label: 'Banned profiles', path: 'users' },
  { key: 'circles', label: 'Circles', path: 'circles' },
  { key: 'questions', label: 'Ask questions', path: 'ask-moderation' },
  { key: 'posts', label: 'Posts', path: 'posts' },
  { key: 'videos', label: 'Videos', path: 'videos' },
  { key: 'stories', label: 'Stories' },
  { key: 'comments', label: 'Comments', path: 'comments' },
  { key: 'messages', label: 'Message records' },
];

const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const fullDay = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });

function NewProfiles({ data }: { data: AdminSnapshot['signups'] }) {
  const peak = Math.max(1, ...data.map(({ count }) => count));
  const total = data.reduce((sum, day) => sum + day.count, 0);

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-6" aria-labelledby="signup-heading">
      <h2 id="signup-heading" className="text-base font-semibold">New profiles</h2>
      <p className="mt-1 text-sm text-muted-foreground">Last seven calendar days in UTC</p>
      <p className="mt-4 text-3xl font-semibold tabular-nums">{total.toLocaleString()}</p>
      <dl className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-3">
        {data.map(({ day, count }) => {
          const date = new Date(day);
          return (
            <div key={day} className="grid min-w-0 grid-rows-[1fr_auto] gap-2 text-center">
              <dt className="row-start-2 text-xs text-muted-foreground" title={fullDay.format(date)}>
                <span aria-hidden="true">{dayLabel.format(date)}</span><span className="sr-only">{fullDay.format(date)}</span>
              </dt>
              <dd className="row-start-1 flex min-w-0 flex-col items-center gap-1.5">
                <span className="max-w-full truncate text-xs font-medium tabular-nums">{count.toLocaleString()}</span>
                <div className="flex h-24 w-full max-w-10 items-end overflow-hidden rounded-md bg-muted/65" aria-hidden="true">
                  <span className="w-full rounded-md bg-primary/85" style={{ height: `${count / peak * 100}%` }} />
                </div>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export default function AdminDashboard() {
  const snapshot = useAdminSnapshot();
  const { adminRole } = useAdminAuth();
  const data = snapshot.isSuccess ? snapshot.data : undefined;
  const shortcuts = [
    { label: 'Platform health', path: 'platform-health', icon: HeartPulse },
    ...(adminRole === 'super_admin' ? [{ label: 'Wallet operations', path: 'wallet', icon: Wallet }] : []),
    { label: 'Manage Circle communities', path: 'circles', icon: CircleDot },
    { label: 'Manage users', path: 'users', icon: Users },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.65rem,3.5vw,2.3rem)] font-bold leading-tight tracking-tight">Operations dashboard</h1>
          {data && <p className="mt-1.5 text-sm text-muted-foreground">Updated <time dateTime={data.checkedAt.toISOString()}>{data.checkedAt.toLocaleString()}</time></p>}
        </div>
        <Button variant="outline" className="h-11 bg-card" disabled={snapshot.isFetching} onClick={() => void snapshot.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />{snapshot.isFetching ? 'Refreshing…' : 'Refresh data'}
        </Button>
      </header>

      {snapshot.isPending && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" role="status" aria-label="Loading operations data">
          {work.map(({ key }) => <Skeleton className="h-28 rounded-2xl" key={key} />)}
        </div>
      )}
      {snapshot.isError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-4">
          <p className="font-semibold">Operations data unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">Refresh to try the database request again.</p>
        </div>
      )}

      {data && (
        <section aria-labelledby="review-heading" className="space-y-3">
          <h2 id="review-heading" className="text-lg font-semibold">Review work</h2>
          <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {work.map(({ key, label, path, icon: Icon }) => (
              <li key={key} className="min-w-0">
                <Link to={`/admin/${path}`} className="group block h-full rounded-2xl border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:p-5">
                  <span className="flex items-center justify-between gap-2" aria-hidden="true">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={17} /></span>
                    <ArrowUpRight size={15} className="text-muted-foreground transition-colors group-hover:text-primary" />
                  </span>
                  <span className="mt-3 block text-3xl font-semibold tracking-tight tabular-nums">{data.counts[key].toLocaleString()}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:gap-6">
        {data && <NewProfiles data={data.signups} />}
        <section className="rounded-2xl border bg-card p-4 sm:p-6" aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="text-base font-semibold">Workspace tools</h2>
          <ul className="mt-2 divide-y">
            {shortcuts.map(({ label, path, icon: Icon }) => (
              <li key={path}>
                <Link to={`/admin/${path}`} className="flex min-h-12 items-center gap-3 rounded-md py-2.5 text-sm font-medium hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  <Icon size={17} aria-hidden="true" className="shrink-0 text-primary" /><span className="flex-1">{label}</span><ArrowUpRight size={15} aria-hidden="true" className="text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {data && (
        <section className="rounded-2xl border bg-card p-4 sm:p-6" aria-labelledby="records-heading">
          <h2 id="records-heading" className="flex items-center gap-2 text-base font-semibold"><FileText size={17} aria-hidden="true" className="text-primary" /> Platform records</h2>
          <dl className="mt-3 grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
            {records.map(({ key, label, path }) => (
              <div className="flex min-h-11 items-center justify-between gap-3 border-t py-2 text-sm" key={key}>
                <dt>{path ? <Link className="rounded-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" to={`/admin/${path}`}>{label}</Link> : label}</dt>
                <dd className="font-semibold tabular-nums">{data.counts[key].toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
