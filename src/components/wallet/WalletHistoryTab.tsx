import { ArrowDownLeft, ArrowUpRight, History, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useWalletActivity } from '@/hooks/useWalletHistory';
import { walletDate, walletShortDate } from '@/lib/walletHistory';
import { WalletPaymentHistory, type WalletPaymentCheck } from './WalletPaymentHistory';

export const transactionTypeLabels:Record<string,string>={topup:'Top up',tip_sent:'Tip sent',tip_received:'Tip received',purchase:'Purchase',sale:'Sale',event_payment:'Event payment',event_earned:'Event earnings',service_payment:'Service payment',service_earned:'Service earnings',subscription:'Subscription',withdrawal:'Withdrawal',refund:'Refund',premium_unlock:'Premium unlock',premium_earning:'Premium earnings'};
export function WalletHistoryTab({userId,check}: {userId?:string;check:WalletPaymentCheck}) {
  const activity=useWalletActivity(userId);
  const transactions=activity.data?.pages.flatMap(page=>page.items) || [];
  const integrity=activity.data?.pages[0]?.integrity;
  return <Tabs defaultValue="payments">
    <TabsList className="wallet-subtabs" aria-label="Activity type"><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="activity">Coin activity</TabsTrigger></TabsList>
    <TabsContent value="payments" className="mt-0"><WalletPaymentHistory userId={userId} check={check}/></TabsContent>
    <TabsContent value="activity" className="mt-0 space-y-4">
      {integrity?.status==='balanced' && <p className="wallet-field-help">{integrity.baselineAt ? `Balance checked against recorded activity since ${walletDate(integrity.baselineAt)}. The earlier balance was preserved.` : 'Your balance matches the recorded wallet movements.'}</p>}
      {integrity?.status==='needs_review' && <p role="alert" className="wallet-notice wallet-notice--danger"><Info aria-hidden="true"/><span>Your wallet balance needs review. Keep your payment receipts and contact support.</span></p>}
      {activity.isLoading && <div className="wallet-empty"><SerkleLoader label="Loading coin activity" showText/></div>}
      {activity.isError && <div role="alert" className="wallet-notice wallet-notice--danger"><Info aria-hidden="true"/><div><strong>Coin activity could not be refreshed.</strong><Button variant="ghost" className="wallet-button wallet-button--quiet" onClick={()=>void activity.refetch()}>Retry activity</Button></div></div>}
      {!activity.isLoading && !activity.isError && !transactions.length && <div className="wallet-empty"><History aria-hidden="true"/><h3>No coin movements yet</h3><p>Test and pending payments appear under Payments.</p></div>}
      {!!transactions.length && <div className="wallet-list">{transactions.map(tx=>{
        const positive=tx.amount>0;
        const label=tx.type==='refund' && tx.amount<0 ? 'Funding reversed' : transactionTypeLabels[tx.type] || tx.type;
        return <article key={tx.id} className="wallet-ledger-entry">
          <div className="wallet-ledger-top"><span className="wallet-row-icon">{positive ? <ArrowDownLeft aria-hidden="true"/> : <ArrowUpRight aria-hidden="true"/>}</span>
            <div className="wallet-ledger-info"><h3>{label}</h3><p>{tx.description}</p><p><time dateTime={tx.created_at} title={walletDate(tx.created_at)}>{walletShortDate(tx.created_at)}</time></p></div>
            <div className="wallet-ledger-amount"><strong style={{color:`hsl(var(--wallet-${positive ? 'success' : 'danger'}))`}}>{positive ? '+' : ''}{tx.amount.toLocaleString()} <span className="text-xs font-normal">coins</span></strong><p>Balance: {tx.balance_after.toLocaleString()}</p></div>
          </div>
          <details className="wallet-movement-details"><summary>View movement details</summary><dl><dt>Ledger entry</dt><dd className="font-mono">{tx.id}</dd><dt>Linked reference</dt><dd className="font-mono">{tx.reference_id || 'Legacy record: no linked receipt'}</dd>{tx.operation_id && <><dt>Wallet operation</dt><dd className="font-mono">{tx.operation_id}</dd></>}<dt>Recorded balance after</dt><dd>{tx.balance_after.toLocaleString()} coins</dd></dl></details>
        </article>;
      })}</div>}
      {activity.hasNextPage && <Button variant="ghost" className="wallet-button wallet-button--quiet w-full" disabled={activity.isFetchingNextPage} onClick={()=>void activity.fetchNextPage()}>{activity.isFetchingNextPage ? <SerkleLoader size="xs" label="Loading coin activity"/> : 'Load more coin activity'}</Button>}
    </TabsContent>
  </Tabs>;
}
