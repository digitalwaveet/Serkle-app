import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, Copy, Info, Printer, ReceiptText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useWalletPayments, useWalletReceipt } from '@/hooks/useWalletHistory';
import { walletDate, walletShortDate, walletMoney, walletPaymentStatus, walletEventLabels, walletSourceLabels, type WalletMode } from '@/lib/walletHistory';
import { WalletPaymentStatus } from './WalletPaymentStatus';
import { WalletReceipt } from './WalletReceipt';

export interface WalletPaymentCheck {
  isPending: boolean;
  variables?: {txRef?:string};
  mutateAsync: (input:{txRef?:string})=>Promise<unknown>;
}
export function WalletPaymentHistory({userId,check}: {userId?:string;check:WalletPaymentCheck}) {
  const [mode,setMode]=useState<WalletMode>('all');
  const [selected,setSelected]=useState<string|null>(null);
  const [checkError,setCheckError]=useState<string|null>(null);
  const [copied,setCopied]=useState(false);
  const openedBy=useRef<HTMLButtonElement|null>(null);
  const payments=useWalletPayments(userId,mode);
  const receipt=useWalletReceipt(userId,selected);
  const payment=receipt.data?.pages[0]?.payment;
  const ledger=receipt.data?.pages[0]?.ledger || [];
  const events=receipt.data?.pages.flatMap(part=>part.items) || [];
  const items=payments.data?.pages.flatMap(part=>part.items) || [];
  useEffect(()=>{setSelected(null);},[userId]);
  useEffect(()=>{setCheckError(null);setCopied(false);},[selected]);
  const recheck=async()=>{
    if(!payment || check.isPending)return;
    setCheckError(null);
    try {await check.mutateAsync({txRef:payment.tx_ref});}
    catch(error){setCheckError(error instanceof Error ? error.message : 'Status could not be checked. This receipt remains saved.');}
    finally {void receipt.refetch();void payments.refetch();}
  };
  const copy=async()=>{
    if(!payment)return;
    try {
      await navigator.clipboard.writeText([
        'Serkle payment receipt',`Receipt: ${payment.id}`,`Reference: ${payment.tx_ref}`,
        `Provider receipt: ${payment.provider_reference || 'Not yet confirmed'}`,`Mode: ${payment.mode}`,
        `Amount: ${walletMoney(payment.amount,payment.currency)}`,`Status: ${walletPaymentStatus(payment)}`,
        `Method: ${payment.payment_method || 'Not provided'}`,`Provider-reported fee: ${payment.provider_fee==null ? 'Not provided' : walletMoney(payment.provider_fee,payment.currency)}`,
        `Created: ${walletDate(payment.created_at)}`,`Last verified: ${walletDate(payment.verified_at)}`,
        `Recorded coin movement: ${ledger.reduce((sum,entry)=>sum+entry.amount,0)}`,
        payment.mode==='test' ? 'TEST ONLY: no spendable coins are added or removed.' : 'Saved wallet payment record.',
      ].join('\n'));setCopied(true);
    } catch {setCheckError('Copy is unavailable. You can select the receipt reference or print it instead.');}
  };
  const lastRun=payment ? payments.data?.pages[0]?.automaticChecks?.[payment.mode] : null;
  const freshRun=!!lastRun && Date.now()-Date.parse(lastRun)<300000;
  return <div>
    <div className="wallet-filter-bar"><p>Every recorded payment attempt, including tests and failed checks.</p>
      <select aria-label="Payment mode" value={mode} onChange={event=>setMode(event.target.value as WalletMode)}><option value="all">All modes</option><option value="live">Live</option><option value="test">Test</option></select>
    </div>
    {payments.isLoading && <div className="wallet-empty"><SerkleLoader label="Loading payment receipts" showText/></div>}
    {payments.isError && <div role="alert" className="wallet-notice wallet-notice--danger"><Info aria-hidden="true"/><div><strong>Payment history could not be refreshed.</strong>Your existing receipts remain saved.<Button variant="ghost" className="wallet-button wallet-button--quiet mt-2" onClick={()=>void payments.refetch()}>Retry</Button></div></div>}
    {!payments.isLoading && !payments.isError && !items.length && <div className="wallet-empty"><ReceiptText aria-hidden="true"/><h3>No payment receipts yet</h3><p>No payment receipts in this mode. Older wallet movements remain in Coin activity.</p></div>}
    {!!items.length && <div className="wallet-list">{items.map(item=><button key={item.id} onClick={event=>{openedBy.current=event.currentTarget;setSelected(item.id);}} className="wallet-payment-row">
      <span className="wallet-row-icon">{item.kind==='withdrawal' ? <ArrowUpRight aria-hidden="true"/> : <ArrowDownLeft aria-hidden="true"/>}</span>
      <span className="min-w-0"><span className="wallet-row-title">{item.kind==='withdrawal' ? 'Withdrawal' : 'Wallet top-up'}</span>
        <time dateTime={item.created_at} title={walletDate(item.created_at)} className="wallet-row-date">{walletShortDate(item.created_at)}</time>
        <span className="wallet-row-reference">{item.tx_ref}</span>
        <span className="mt-2 inline-block"><WalletPaymentStatus payment={item}/></span>
      </span>
      <span className="wallet-row-right"><span className="wallet-row-amount">{walletMoney(item.amount,item.currency)}</span><span className="wallet-mode">{item.mode==='test' ? 'Test' : 'Live'}</span><ChevronRight size={16} className="mt-1 text-muted-foreground" aria-hidden="true"/></span>
      <span className="sr-only">View receipt and status history</span>
    </button>)}</div>}
    {payments.hasNextPage && <Button variant="ghost" className="wallet-button wallet-button--quiet w-full mt-3" disabled={payments.isFetchingNextPage} onClick={()=>void payments.fetchNextPage()}>{payments.isFetchingNextPage ? <><SerkleLoader size="xs" label="Loading more payments"/>Loading…</> : 'Load more payments'}</Button>}
    <Dialog.Root open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}>
      <Dialog.Portal><Dialog.Overlay className="wallet-dialog-overlay"/>
        <Dialog.Content className="wallet-ui wallet-receipt-dialog" aria-describedby="wallet-receipt-description" onCloseAutoFocus={event=>{event.preventDefault();openedBy.current?.focus();}}>
          <header className="wallet-dialog-header"><Dialog.Title>{payment?.kind==='withdrawal' ? 'Withdrawal receipt' : 'Payment receipt'}</Dialog.Title><Dialog.Close className="wallet-icon-button" aria-label="Close receipt"><X aria-hidden="true"/></Dialog.Close></header>
          <Dialog.Description id="wallet-receipt-description" className="sr-only">Recorded payment details and wallet movements. Checking status never starts another payment.</Dialog.Description>
          <div className="wallet-receipt-scroll">
            {receipt.isLoading && <div className="wallet-empty"><SerkleLoader label="Loading receipt" showText/></div>}
            {receipt.isError && <div role="alert" className="wallet-notice wallet-notice--danger"><div><strong>Receipt details could not be loaded.</strong><Button variant="ghost" className="wallet-button wallet-button--quiet" onClick={()=>void receipt.refetch()}>Retry receipt</Button></div></div>}
            {payment && <>
              <WalletReceipt payment={payment} ledger={ledger}/>
              {payment.mode==='test' && <p className="wallet-notice mt-4"><Info aria-hidden="true"/><span>Test payments are recorded for testing. They do not add or remove spendable coins.</span></p>}
              {payment.last_error && <p className="wallet-notice mt-4">{payment.last_error}</p>}
              {payment.review_required && <p className="wallet-notice wallet-notice--danger mt-4"><Info aria-hidden="true"/><span>This payment needs review. Keep this receipt and contact support if the status remains unresolved.</span></p>}
              <details className="wallet-audit"><summary>Status history<ChevronDown aria-hidden="true"/></summary>
                <div className="px-4 pb-4 text-xs text-muted-foreground"><p>Status checks: {payment.check_count}</p>{!payment.reversed_at && !payment.restored_at && <p className="mt-1">Next automatic check due: {walletDate(payment.next_check_at)}</p>}<p className="mt-2">{freshRun ? `Automatic checks last ran ${walletDate(lastRun)}.` : 'Automatic checks have not been confirmed recently. You can check this receipt manually.'}</p></div>
                <ol className="wallet-timeline">{events.map(event=><li key={event.id}><strong>{walletEventLabels[event.event_type] || 'Payment record updated'}</strong><p>{walletDate(event.created_at)} · {walletSourceLabels[event.source] || 'Server'}</p><p>Recorded status: {event.status}</p>{event.message && <p className="mt-1">{event.message}</p>}</li>)}</ol>
                {receipt.hasNextPage && <Button variant="ghost" className="wallet-button wallet-button--quiet m-2" disabled={receipt.isFetchingNextPage} onClick={()=>void receipt.fetchNextPage()}>{receipt.isFetchingNextPage ? <SerkleLoader size="xs" label="Loading status history"/> : 'Load earlier status updates'}</Button>}
              </details>
              {checkError && <p role="alert" className="wallet-notice wallet-notice--danger mt-4">{checkError}</p>}
              <span role="status" aria-live="polite" className="sr-only">{copied ? 'Receipt details copied' : ''}</span>
            </>}
          </div>
          {payment && <footer className="wallet-receipt-controls">
            {!payment.reversed_at && !payment.restored_at && <Button className="wallet-button wallet-button--primary wallet-check-button" onClick={()=>void recheck()} disabled={check.isPending}>{check.isPending ? <><SerkleLoader size="xs" className="text-current" label="Checking payment status"/>Checking…</> : 'Check payment status'}</Button>}
            <Button variant="outline" className="wallet-button wallet-button--secondary" onClick={()=>void copy()}><Copy aria-hidden="true"/>{copied ? 'Copied' : 'Copy receipt details'}</Button>
            <Button variant="outline" className="wallet-button wallet-button--secondary" onClick={()=>window.print()}><Printer aria-hidden="true"/>Print / Save PDF</Button>
          </footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
