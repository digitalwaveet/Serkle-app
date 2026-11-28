import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUser } from '@/contexts/UserContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionErrorMessage } from '@/lib/edgeFunctionError';

const PAGE_SIZE = 25;
const statuses = {
  all: 'All statuses', pending: 'Pending', failed: 'Failed', succeeded: 'Succeeded',
  refunded: 'Refunded', reversed: 'Reversed',
};
type Mode = 'live' | 'test';
type Status = keyof typeof statuses;
type Kind = 'all' | 'topup' | 'withdrawal';
type Cursor = { created_at: string; id: string };
type Payment = Cursor & {
  tx_ref: string;
  kind: 'topup' | 'withdrawal';
  status: Exclude<Status, 'all'>;
  amount: number;
  currency: string;
  attempts: number;
  has_check_error: boolean;
  review_required?: boolean;
  verified_at: string | null;
  credited_at: string | null;
  reversed_at: string | null;
  reserved_at: string | null;
  restored_at: string | null;
  submitted_at: string | null;
  next_check_at: string | null;
};
type Operations = {
  checked_at: string;
  summary: { pending: number; failed: number; due: number };
  latest_run: { started_at: string; completed_at: string | null; checked: number; errors: number } | null;
  items: Payment[];
};

const time = (value: string) => new Date(value).toLocaleString();
type Configuration = { activeMode: Mode; availableModes: Mode[] };

async function chapaAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('chapa-admin', { body });
  if (error) throw new Error(await edgeFunctionErrorMessage(error));
  return data;
}

async function chapaAdminConfiguration(body: Record<string, unknown>): Promise<Configuration> {
  const data = await chapaAdmin(body);
  if ((data?.activeMode !== 'test' && data?.activeMode !== 'live') || !Array.isArray(data.availableModes)
    || data.availableModes.some((mode: unknown) => mode !== 'test' && mode !== 'live')) throw new Error('Could not confirm payment configuration.');
  return { activeMode: data.activeMode, availableModes: data.availableModes };
}

function PaymentRow({ payment, mode, onCheck, checking }: { payment: Payment; mode: Mode; onCheck: () => void; checking: boolean }) {
  const rows = [
    { label: 'Provider verified', value: payment.verified_at },
    { label: 'Wallet credited', value: payment.credited_at },
    { label: 'Funds reserved', value: payment.reserved_at },
    { label: 'Payout submission attempted', value: payment.submitted_at },
    { label: 'Funds restored', value: payment.restored_at },
    { label: 'Reversed', value: payment.reversed_at },
    { label: 'Next eligible check', value: payment.reversed_at ? null : payment.next_check_at },
  ];

  return (
    <li>
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3.5 hover:bg-muted/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden sm:px-5">
          <span className="font-medium">{payment.kind === 'topup' ? 'Top-up' : 'Withdrawal'}</span>
          <span className="font-semibold tabular-nums">{payment.amount.toLocaleString()} {payment.currency}</span>
          <code className="break-all text-xs leading-5 text-muted-foreground">{payment.tx_ref}</code>
          <span className="flex items-center justify-end gap-1.5">
            <Badge variant={payment.status === 'failed' ? 'destructive' : 'secondary'}>{statuses[payment.status]}</Badge>
            <ChevronDown aria-hidden="true" size={14} className="text-muted-foreground group-open:rotate-180" />
          </span>
        </summary>
        <div className="space-y-3 bg-muted/40 px-4 py-4 sm:px-5">
          {mode === 'test' && <p className="text-sm text-muted-foreground">Test payments do not create spendable coins.</p>}
          {payment.has_check_error && <p className="text-sm font-medium text-destructive">A processing error is recorded for this payment.</p>}
          {payment.review_required && <Badge variant="destructive">Needs review</Badge>}
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">Created</dt><dd className="mt-0.5 text-sm">{time(payment.created_at)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Recorded check attempts</dt><dd className="mt-0.5 text-sm tabular-nums">{payment.attempts}</dd></div>
            {rows.filter(({ value }) => value).map(({ label, value }) => (
              <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm">{time(value!)}</dd></div>
            ))}
          </dl>
          {payment.kind === 'withdrawal' && (
            <Button variant="outline" size="sm" disabled={checking} onClick={onCheck}>
              <RefreshCw size={15} className="mr-1.5" aria-hidden="true" />{checking ? 'Checking…' : 'Check withdrawal status'}
            </Button>
          )}
        </div>
      </details>
    </li>
  );
}

export default function AdminWalletOperations() {
  const { session } = useUser();
  const userId = session?.user.id;
  const { adminRole } = useAdminAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('live');
  const [kind, setKind] = useState<Kind>('all');
  const [status, setStatus] = useState<Status>('all');
  const [input, setInput] = useState('');
  const [reference, setReference] = useState('');
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [modeDecision, setModeDecision] = useState<Mode | null>(null);
  const cursor = cursors[cursors.length - 1];
  const canManage = Boolean(userId) && adminRole === 'super_admin';
  const walletKey = ['admin', 'wallet-operations', userId] as const;
  const configKey = ['admin', 'chapa-configuration', userId] as const;
  const config = useQuery({
    queryKey: configKey, enabled: canManage, gcTime: 0, retry: false, networkMode: 'always',
    queryFn: () => chapaAdminConfiguration({ action: 'configuration' }),
  });
  const switchMode = useMutation({
    mutationFn: ({ next, expected }: { next: Mode; expected: Mode }) => chapaAdminConfiguration({ action: 'set_mode', mode: next, expectedMode: expected }),
    onSuccess: async (result) => {
      queryClient.setQueryData(configKey, result);
      setModeDecision(null);
      toast.success(`New payments now use ${result.activeMode} mode.`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: configKey }), queryClient.invalidateQueries({ queryKey: ['chapa-banks'] })]);
    },
    onError: (error) => {
      toast.error(error.message);
      setModeDecision(null);
      void queryClient.invalidateQueries({ queryKey: configKey });
    },
  });
  const checkWithdrawal = useMutation({
    mutationFn: async (reference: string) => {
      const data = await chapaAdmin({ action: 'check_withdrawal', reference });
      if (data?.reference !== reference || !Object.hasOwnProperty.call(statuses, data.status) || data.status === 'all') throw new Error('Could not confirm the withdrawal status.');
      return data.status as Exclude<Status, 'all'>;
    },
    onSuccess: (result) => { toast.success(`Withdrawal status: ${statuses[result]}`); },
    onError: (error) => { toast.error(error.message); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: walletKey }),
  });
  const wallet = useQuery({
    queryKey: [...walletKey, mode, kind, status, reference, cursor?.id, cursor?.created_at],
    enabled: canManage,
    gcTime: 0,
    retry: false,
    networkMode: 'always',
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_admin_wallet_operations', {
        _mode: mode, _status: status, _reference: reference || undefined, _kind: kind,
        _before_id: cursor?.id, _before_created_at: cursor?.created_at,
      }).abortSignal(signal);
      if (error) throw error;
      const result = data as unknown as Operations | null;
      if (!result?.summary || !Array.isArray(result.items) || typeof result.checked_at !== 'string') {
        throw new Error('Invalid wallet operations response');
      }
      return result;
    },
  });

  if (adminRole !== 'super_admin') return (
    <section className="rounded-2xl border bg-card p-5">
      <h1 className="text-xl font-semibold">Wallet operations</h1>
      <p className="mt-2 text-sm text-muted-foreground">Payment monitoring is available to super admins.</p>
    </section>
  );

  const data = wallet.isSuccess ? wallet.data : undefined;
  const items = data?.items.slice(0, PAGE_SIZE) ?? [];
  const run = data?.latest_run;

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Wallet operations</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Monitor Chapa payments and automated reconciliation.</p>
        </div>
        <Button variant="outline" className="h-11 bg-card" disabled={wallet.isFetching} onClick={() => void wallet.refetch()}><RefreshCw className="mr-2 h-4 w-4" />{wallet.isFetching ? 'Refreshing…' : 'Refresh records'}</Button>
      </header>

      <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="chapa-settings-heading">
        <h2 id="chapa-settings-heading" className="text-base font-semibold">Chapa payment mode</h2>
        {config.isPending && <p role="status" className="mt-1 text-sm text-muted-foreground">Checking payment configuration…</p>}
        {config.isError && <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span>Could not load payment configuration.</span><Button variant="outline" size="sm" disabled={config.isFetching} onClick={() => void config.refetch()}>Retry</Button></div>}
        {config.isSuccess && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">New payments use <strong className="capitalize text-foreground">{config.data.activeMode}</strong> mode. Existing payments keep their recorded mode.</p>
            {!config.data.availableModes.includes(config.data.activeMode) && <p role="alert" className="mt-2 text-sm text-destructive">The active mode needs a matching Chapa secret in Supabase.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {(['test', 'live'] as const).map((candidate) => (
                <Button key={candidate} variant="outline" disabled={candidate === config.data.activeMode || !config.data.availableModes.includes(candidate) || config.isFetching || switchMode.isPending} onClick={() => setModeDecision(candidate)}>
                  {candidate === 'live' ? 'Use live mode' : 'Use test mode'}{!config.data.availableModes.includes(candidate) && ' · key required'}
                </Button>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Payment environment">
        {(['live', 'test'] as const).map((value) => (
          <Button key={value} variant={mode === value ? 'default' : 'outline'} aria-pressed={mode === value} className="h-11" onClick={() => { setMode(value); setCursors([]); }}>
            {value === 'live' ? 'Live payments' : 'Test payments'}
          </Button>
        ))}
      </div>

      {wallet.isPending && <Skeleton aria-label="Loading payment records" role="status" className="h-36 rounded-2xl" />}
      {wallet.isError && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-card p-4 text-sm">
          Could not load wallet records. Check the connection and refresh.
        </p>
      )}
      {data && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <dl className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-3.5 sm:p-5" aria-label="Mode totals">
            {([{ label: 'Pending', value: data.summary.pending }, { label: 'Failed', value: data.summary.failed }, { label: 'Due to check', value: data.summary.due }]).map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-label="Latest reconciliation run">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Latest reconciliation run</h2>
              {run?.completed_at && <Badge variant={run.errors ? 'destructive' : 'outline'}>{run.errors ? 'Completed with errors' : 'Completed'}</Badge>}
            </div>
            {run?.completed_at ? (
              <p className="mt-1 text-sm text-muted-foreground">{time(run.completed_at)} · {run.checked} checked · {run.errors} errors</p>
            ) : <p className="mt-1 text-sm text-muted-foreground">{run ? `Started ${time(run.started_at)}. Completion is unconfirmed.` : 'No recorded reconciliation run for this mode.'}</p>}
          </section>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border bg-card" aria-labelledby="payment-records-heading">
        <div className="space-y-3 border-b p-4 sm:p-5">
          <h2 id="payment-records-heading" className="flex items-center gap-2 font-semibold"><Wallet size={18} className="text-primary" aria-hidden="true" />Payment records</h2>
          <div className="flex flex-wrap gap-2">
            <form className="flex min-w-0 flex-1 basis-60 gap-2" onSubmit={(event) => { event.preventDefault(); setReference(input.trim()); setCursors([]); }} role="search" aria-label="Find a payment">
              <Input className="h-11 min-w-0" aria-label="Exact transaction reference" maxLength={160} placeholder="Exact transaction reference" value={input} onChange={(event) => setInput(event.target.value)} />
              <Button type="submit" variant="outline" className="h-11 w-11 shrink-0 px-0" aria-label="Search payments"><Search size={17} /></Button>
            </form>
            <Select value={status} onValueChange={(value: Status) => { setStatus(value); setCursors([]); }}>
              <SelectTrigger className="h-11 w-40" aria-label="Filter payment status"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(statuses).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={kind} onValueChange={(value: Kind) => { setKind(value); setCursors([]); }}>
              <SelectTrigger className="h-11 w-40" aria-label="Payment type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All payment types</SelectItem><SelectItem value="topup">Top-ups</SelectItem><SelectItem value="withdrawal">Withdrawals</SelectItem></SelectContent>
            </Select>
            {(reference || status !== 'all') && <Button variant="ghost" className="h-11" onClick={() => { setInput(''); setReference(''); setStatus('all'); setCursors([]); }}>Clear filters</Button>}
          </div>
        </div>
        {data && (items.length ? <ul className="divide-y">{items.map((row) => <PaymentRow key={row.id} payment={row} mode={mode} checking={checkWithdrawal.isPending} onCheck={() => checkWithdrawal.mutate(row.tx_ref)} />)}</ul> : (
          <p className="px-4 py-9 text-center text-sm text-muted-foreground">No payments match these filters.</p>
        ))}
        {data && (cursors.length > 0 || data.items.length > PAGE_SIZE) && (
          <nav aria-label="Payment pages" className="flex items-center justify-between gap-2 border-t p-3 sm:p-4">
            <Button variant="outline" size="sm" className="h-10" disabled={cursors.length === 0} onClick={() => setCursors((current) => current.slice(0, -1))}><ChevronLeft size={16} />Previous</Button>
            <span className="text-sm text-muted-foreground">Page {cursors.length + 1}</span>
            <Button variant="outline" size="sm" className="h-10" disabled={data.items.length <= PAGE_SIZE} onClick={() => {
              const last = items[PAGE_SIZE - 1];
              if (last) setCursors((current) => [...current, { id: last.id, created_at: last.created_at }]);
            }}>Next<ChevronRight size={16} /></Button>
          </nav>
        )}
      </section>
      <Dialog open={modeDecision !== null} onOpenChange={(open) => { if (!open && !switchMode.isPending) setModeDecision(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to {modeDecision} mode?</DialogTitle>
            <DialogDescription>{modeDecision === 'live' ? 'New top-ups and withdrawals will use real money.' : 'New top-ups and withdrawals will run in Chapa’s test environment.'} Existing payment receipts keep their current environment.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={switchMode.isPending} onClick={() => setModeDecision(null)}>Cancel</Button>
            <Button disabled={switchMode.isPending || !modeDecision || !config.data} onClick={() => { if (modeDecision && config.data) switchMode.mutate({ next: modeDecision, expected: config.data.activeMode }); }}>{switchMode.isPending ? 'Saving…' : 'Confirm mode change'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
