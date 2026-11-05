import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useWalletPayments, useWalletReceipt } from '@/hooks/useWalletHistory';
import { walletDate, walletMoney, walletPaymentStatus, walletEventLabels, walletSourceLabels, type WalletMode } from '@/lib/walletHistory';
import { Copy, RefreshCw } from 'lucide-react';

export interface WalletPaymentCheck {
  isPending: boolean;
  variables?: { txRef?: string };
  mutateAsync: (input: { txRef?: string }) => Promise<unknown>;
}

function ReceiptField({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all text-sm">{value}</dd></div>;
}

export function WalletPaymentHistory({ userId, check }: { userId?: string; check: WalletPaymentCheck }) {
  const [mode, setMode] = useState<WalletMode>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const payments = useWalletPayments(userId, mode);
  const receipt = useWalletReceipt(userId, selected);
  const page = receipt.data?.pages[0];
  const payment = page?.payment;
  const ledger = page?.ledger || [];
  const events = receipt.data?.pages.flatMap(part => part.items) || [];
  const items = payments.data?.pages.flatMap(part => part.items) || [];
  useEffect(() => { setSelected(null); }, [userId]);
  useEffect(() => { setCheckError(null); setCopied(false); }, [selected]);

  const recheck = async () => {
    if (!payment || check.isPending) return;
    setCheckError(null);
    try { await check.mutateAsync({ txRef: payment.tx_ref }); }
    catch (error) { setCheckError(error instanceof Error ? error.message : 'Status could not be checked. This receipt remains saved.'); }
    finally { void receipt.refetch(); void payments.refetch(); }
  };
  const copy = async () => {
    if (!payment) return;
    try {
      await navigator.clipboard.writeText([
        'Serkle payment receipt', `Receipt: ${payment.id}`, `Reference: ${payment.tx_ref}`,
        `Provider receipt: ${payment.provider_reference || 'Not yet confirmed'}`, `Mode: ${payment.mode}`,
        `Amount: ${walletMoney(payment.amount, payment.currency)}`, `Status: ${walletPaymentStatus(payment)}`,
        `Created: ${walletDate(payment.created_at)}`, `Last verified: ${walletDate(payment.verified_at)}`,
        `Recorded coin movement: ${ledger.reduce((sum, entry) => sum + entry.amount, 0)}`,
      ].join('\n'));
      setCopied(true);
    } catch { setCheckError('Copy is unavailable. You can select the receipt reference below.'); }
  };

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">Every recorded payment attempt, including tests and failed checks.</p>
      <select aria-label="Payment mode" value={mode} onChange={event => setMode(event.target.value as WalletMode)} className="rounded-lg border bg-background p-2 text-xs">
        <option value="all">All modes</option><option value="live">Live</option><option value="test">Test</option>
      </select>
    </div>
    {payments.isLoading && <SerkleLoader label="Loading payment receipts" showText />}
    {payments.isError && <div role="alert" className="rounded-xl border p-3 text-sm">
      Payment history could not be refreshed. Your existing receipts remain saved.
      <Button variant="ghost" onClick={() => void payments.refetch()}>Retry</Button>
    </div>}
    {!payments.isLoading && !payments.isError && !items.length && <p className="py-6 text-center text-sm text-muted-foreground">No payment receipts in this mode. Older wallet movements remain in Coin activity.</p>}
    {items.map(item => <button key={item.id} onClick={() => setSelected(item.id)} className="w-full rounded-xl border border-border/40 bg-card/40 p-3.5 text-left">
      <div className="flex items-center justify-between gap-2"><span className="font-semibold">{walletMoney(item.amount, item.currency)} · {item.kind === 'withdrawal' ? 'Withdrawal' : 'Top up'}</span><Badge variant="outline">{item.mode === 'test' ? 'Test' : 'Live'}</Badge></div>
      <p className="mt-2 text-sm font-medium">{walletPaymentStatus(item)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{walletDate(item.created_at)}</p>
      <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{item.tx_ref}</p>
      <span className="mt-2 inline-block text-xs text-primary">View receipt and status history</span>
    </button>)}
    {payments.hasNextPage && <Button variant="ghost" className="w-full" disabled={payments.isFetchingNextPage} onClick={() => void payments.fetchNextPage()}>
      {payments.isFetchingNextPage ? 'Loading…' : 'Load more payments'}
    </Button>}

    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>{payment?.kind === 'withdrawal' ? 'Withdrawal receipt' : 'Payment receipt'}</DialogTitle><DialogDescription>Recorded payment details and wallet movements. Checking status never starts another payment.</DialogDescription></DialogHeader>
        {receipt.isLoading && <SerkleLoader label="Loading receipt" showText />}
        {receipt.isError && <div role="alert">Receipt details could not be loaded.<Button variant="ghost" onClick={() => void receipt.refetch()}>Retry receipt</Button></div>}
        {payment && <>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xl font-bold">{walletMoney(payment.amount, payment.currency)}</span><Badge variant="outline">{payment.mode === 'test' ? 'Test payment' : 'Live payment'}</Badge></div>
          <p className="font-semibold">{walletPaymentStatus(payment)}</p>
          {payment.mode === 'test' && <p className="rounded-lg bg-muted p-3 text-sm">Test payments are recorded for testing. They do not add or remove spendable coins.</p>}
          {payment.last_error && <p className="rounded-lg border p-3 text-sm">{payment.last_error}</p>}
          {payment.review_required && <p className="text-sm">This payment needs review. Keep this receipt and contact support if the status remains unresolved.</p>}
          <dl className="grid grid-cols-2 gap-4">
            <ReceiptField label="Receipt ID" value={payment.id} /><ReceiptField label="Payment reference" value={payment.tx_ref} />
            <ReceiptField label="Provider receipt" value={payment.provider_reference || 'Not yet confirmed'} /><ReceiptField label="Payment method" value={payment.payment_method || 'Not provided'} />
            <ReceiptField label="Provider-reported fee" value={payment.provider_fee == null ? 'Not provided' : walletMoney(payment.provider_fee, payment.currency)} />
            <ReceiptField label="Status checks" value={payment.check_count} />
            <ReceiptField label="Created" value={walletDate(payment.created_at)} /><ReceiptField label="Last verified" value={walletDate(payment.verified_at)} />
            {payment.kind === 'withdrawal' ? <><ReceiptField label="Coins reserved" value={walletDate(payment.reserved_at)} /><ReceiptField label="Coins returned" value={walletDate(payment.restored_at)} /><ReceiptField label="Submission started" value={walletDate(payment.submitted_at)} /><ReceiptField label="Destination" value={payment.destination_hint || 'Not provided'} /></> : <><ReceiptField label="Wallet credited" value={walletDate(payment.credited_at)} /><ReceiptField label="Funding reversed" value={walletDate(payment.reversed_at)} /></>}
            {!payment.reversed_at && !payment.restored_at && <ReceiptField label="Next automatic check due" value={walletDate(payment.next_check_at)} />}
          </dl>
          {(() => {
            const last = payments.data?.pages[0]?.automaticChecks?.[payment.mode];
            const fresh = !!last && Date.now() - Date.parse(last) < 300000;
            return <p className="text-xs text-muted-foreground">{fresh ? `Automatic checks last ran ${walletDate(last)}.` : 'Automatic checks have not been confirmed recently. You can check this receipt manually.'}</p>;
          })()}
          <div className="flex flex-wrap gap-2">
            {!payment.reversed_at && !payment.restored_at && <Button onClick={() => void recheck()} disabled={check.isPending}><RefreshCw className="mr-2 size-4" />{check.isPending ? 'Checking…' : 'Check payment status'}</Button>}
            <Button variant="outline" onClick={() => void copy()}><Copy className="mr-2 size-4" />{copied ? 'Copied' : 'Copy receipt details'}</Button>
          </div>
          {checkError && <p role="alert" className="text-sm text-destructive">{checkError}</p>}
          <section className="space-y-2"><h3 className="font-semibold">Recorded wallet movements</h3>
            {!ledger.length && <p className="text-sm text-muted-foreground">No spendable coin movement has been recorded for this payment.</p>}
            {ledger.map(entry => <div key={entry.id} className="rounded-lg border p-3 text-sm">
              <p>{entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()} coins · Balance after: {entry.balance_after.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">{entry.description} · {walletDate(entry.created_at)}</p>
              <p className="mt-1 break-all font-mono text-[10px]">Ledger entry: {entry.id}</p>
            </div>)}
          </section>
          <section className="space-y-2"><h3 className="font-semibold">Status history</h3>
            {events.map(event => <div key={event.id} className="border-l-2 border-border py-1 pl-3 text-sm">
              <p>{walletEventLabels[event.event_type] || 'Payment record updated'}</p>
              <p className="text-xs text-muted-foreground">{walletDate(event.created_at)} · {walletSourceLabels[event.source] || 'Server'}</p>
              <p className="text-xs">Recorded status: {event.status}</p>
              {event.message && <p className="mt-1 text-xs">{event.message}</p>}
            </div>)}
            {receipt.hasNextPage && <Button variant="ghost" disabled={receipt.isFetchingNextPage} onClick={() => void receipt.fetchNextPage()}>{receipt.isFetchingNextPage ? 'Loading…' : 'Load earlier status updates'}</Button>}
          </section>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
