import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Coins, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 10;
type Cursor = { balance: number; user_id: string };
type Holder = Cursor & { name: string | null; username: string | null };
type Holdings = {
  checked_at: string;
  summary: { circulating_coins: string; holders: string };
  items: Holder[];
};
const isCount = (value: unknown): value is string => typeof value === 'string' && /^\d+$/.test(value);
const formatCount = (value: string) => BigInt(value).toLocaleString();

export default function AdminCoinHoldings({ userId }: { userId: string }) {
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const cursor = cursors[cursors.length - 1];
  const holdings = useQuery({
    queryKey: ['admin', 'coin-holdings', userId, cursor?.balance, cursor?.user_id],
    gcTime: 0,
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_admin_coin_holdings', {
        _before_balance: cursor?.balance,
        _before_user_id: cursor?.user_id,
        _limit: PAGE_SIZE,
      }).abortSignal(signal);
      if (error) throw error;
      const result = data as unknown as Holdings;
      if (!isCount(result?.summary?.circulating_coins) || !isCount(result?.summary?.holders)
        || typeof result?.checked_at !== 'string' || !Number.isFinite(Date.parse(result.checked_at))
        || !Array.isArray(result.items) || result.items.some(row =>
          typeof row?.user_id !== 'string' || !Number.isSafeInteger(row.balance) || row.balance <= 0)) {
        throw new Error('Invalid coin holdings response');
      }
      return result;
    },
  });
  const data = holdings.data;
  const items = data?.items.slice(0, PAGE_SIZE) ?? [];

  return (
    <section className="overflow-hidden rounded-2xl border bg-card" aria-labelledby="coin-holdings-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5">
        <div>
          <h2 id="coin-holdings-heading" className="flex items-center gap-2 font-semibold">
            <Coins size={18} className="text-primary" aria-hidden="true" /> Coin circulation
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Spendable coins in user wallets across Serkle.</p>
        </div>
        <Button variant="outline" size="sm" disabled={holdings.isFetching} onClick={() => {
          if (cursors.length) setCursors([]);
          else void holdings.refetch();
        }}>
          <RefreshCw className="mr-1.5 size-4" aria-hidden="true" />{holdings.isFetching ? 'Refreshing…' : 'Refresh holdings'}
        </Button>
      </div>
      {holdings.isPending && <p className="p-4 text-sm text-muted-foreground" role="status">Loading coin holdings…</p>}
      {holdings.isError && <p className="p-4 text-sm text-destructive" role="alert">Could not load coin holdings. Refresh to try again.</p>}
      {data && !holdings.isError && <>
        <dl className="grid grid-cols-2 gap-3 border-b bg-muted/35 p-4 sm:p-5">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground sm:text-sm">Coins in circulation</dt>
            <dd className="mt-1 break-words text-xl font-semibold tabular-nums sm:text-2xl">{formatCount(data.summary.circulating_coins)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground sm:text-sm">Users holding coins</dt>
            <dd className="mt-1 break-words text-xl font-semibold tabular-nums sm:text-2xl">{formatCount(data.summary.holders)}</dd>
          </div>
        </dl>
        <div className="px-4 pt-4 sm:px-5">
          <h3 className="text-sm font-semibold">Top coin holders</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Updated <time dateTime={data.checked_at}>{new Date(data.checked_at).toLocaleString()}</time>
          </p>
        </div>
        {items.length ? (
          <ol className="mt-2 divide-y px-4 sm:px-5" aria-label="Coin holders ranked by balance" start={cursors.length * PAGE_SIZE + 1}>
            {items.map((holder, index) => (
              <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-3 sm:gap-4" key={holder.user_id}>
                <span aria-hidden="true" className="text-sm tabular-nums text-muted-foreground">{cursors.length * PAGE_SIZE + index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{holder.name?.trim() || holder.username?.trim() || 'Wallet holder'}</p>
                  <p className="truncate text-xs text-muted-foreground" title={holder.username ? `@${holder.username}` : holder.user_id}>
                    {holder.username ? `@${holder.username}` : holder.user_id}
                  </p>
                </div>
                <p className="whitespace-nowrap text-sm font-semibold tabular-nums">{holder.balance.toLocaleString()} <span className="font-normal text-muted-foreground">coins</span></p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="p-4 text-sm text-muted-foreground sm:px-5">{cursors.length ? 'There are no more holders on this page.' : 'No users currently hold spendable coins.'}</p>
        )}
        {(cursors.length > 0 || data.items.length > PAGE_SIZE) && (
          <nav className="flex flex-wrap items-center justify-between gap-2 border-t p-3 sm:px-5" aria-label="Coin holder pages">
            <Button disabled={!cursors.length || holdings.isFetching} variant="outline" size="sm" onClick={() => setCursors(current => current.slice(0, -1))}>
              <ChevronLeft size={16} aria-hidden="true" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {cursors.length + 1}</span>
            <Button disabled={data.items.length <= PAGE_SIZE || holdings.isFetching} variant="outline" size="sm" onClick={() => {
              const last = items[items.length - 1];
              if (last) setCursors(current => [...current, { balance: last.balance, user_id: last.user_id }]);
            }}>
              Next <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </nav>
        )}
      </>}
    </section>
  );
}
