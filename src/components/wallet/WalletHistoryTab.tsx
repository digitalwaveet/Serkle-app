import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWalletActivity } from '@/hooks/useWalletHistory';
import { walletDate } from '@/lib/walletHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WalletPaymentHistory, type WalletPaymentCheck } from './WalletPaymentHistory';
import { SerkleLoader } from '@/components/ui/SerkleLoader';

export const transactionTypeLabels: Record<string, { label: string; color: string }> = {
  topup: { label: 'Top Up', color: 'text-green-600' },
  tip_sent: { label: 'Tip Sent', color: 'text-orange-600' },
  tip_received: { label: 'Tip Received', color: 'text-green-600' },
  purchase: { label: 'Purchase', color: 'text-red-600' },
  sale: { label: 'Sale', color: 'text-green-600' },
  event_payment: { label: 'Event', color: 'text-blue-600' },
  event_earned: { label: 'Event Earned', color: 'text-green-600' },
  service_payment: { label: 'Service', color: 'text-purple-600' },
  service_earned: { label: 'Service Earned', color: 'text-green-600' },
  subscription: { label: 'Subscription', color: 'text-indigo-600' },
  withdrawal: { label: 'Withdrawal', color: 'text-red-600' },
  refund: { label: 'Refund', color: 'text-green-600' },
  premium_unlock: { label: 'Premium Unlock', color: 'text-purple-600' },
  premium_earning: { label: 'Premium Earned', color: 'text-green-600' },
};

interface WalletHistoryTabProps {
  userId?: string;
  check: WalletPaymentCheck;
}

export const WalletHistoryTab: React.FC<WalletHistoryTabProps> = ({ userId, check }) => {
  const activity = useWalletActivity(userId);
  const transactions = activity.data?.pages.flatMap(page => page.items) || [];
  return <Tabs defaultValue="payments">
    <TabsList className="w-full grid grid-cols-2"><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="activity">Coin activity</TabsTrigger></TabsList>
    <TabsContent value="payments"><WalletPaymentHistory userId={userId} check={check} /></TabsContent>
    <TabsContent value="activity"><div className="space-y-2">
      {activity.data?.pages[0]?.integrity?.status === 'balanced' && <p className="text-xs text-muted-foreground">{activity.data.pages[0].integrity.baselineAt ? `Balance checked against recorded activity since ${walletDate(activity.data.pages[0].integrity.baselineAt)}. The earlier balance was preserved.` : 'Your balance matches the recorded wallet movements.'}</p>}
      {activity.data?.pages[0]?.integrity?.status === 'needs_review' && <p role="alert" className="rounded-lg border p-3 text-sm">Your wallet balance needs review. Keep your payment receipts and contact support.</p>}
      {activity.isLoading && <SerkleLoader label="Loading coin activity" showText />}
      {activity.isError && <div role="alert" className="text-sm">Coin activity could not be refreshed.<Button variant="ghost" onClick={() => void activity.refetch()}>Retry activity</Button></div>}
      {!activity.isLoading && !activity.isError && !transactions.length && <div className="py-8 text-center text-sm text-muted-foreground"><History className="mx-auto mb-2 size-8" />No coin movements yet. Test and pending payments appear under Payments.</div>}
      {transactions.map((tx) => {
        const meta = transactionTypeLabels[tx.type] || { label: tx.type, color: 'text-foreground' };
        const isPositive = tx.amount > 0;
        const label = tx.type === 'refund' && tx.amount < 0 ? 'Funding reversed' : meta.label;
        return (
          <div key={tx.id} className="rounded-xl bg-card/40 backdrop-blur-sm border border-border/30 p-3.5">
            <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 bg-card/30 border-border/40', tx.type === 'refund' && !isPositive ? 'text-destructive' : meta.color)}>
                {label}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1 truncate">{tx.description}</p>
              <p className="text-[10px] text-muted-foreground">
                {walletDate(tx.created_at)}
              </p>
            </div>
            <div className="text-right ml-3">
              <span className={cn('text-sm font-bold flex items-center justify-end gap-1', isPositive ? 'text-green-500' : 'text-red-500')}>
                <Coins className="w-3 h-3 text-yellow-500 shrink-0" />
                {isPositive ? '+' : ''}{tx.amount}
              </span>
              <p className="text-[10px] text-muted-foreground">bal: {tx.balance_after}</p>
            </div>
            </div>
            <details className="mt-3 text-xs"><summary className="cursor-pointer text-primary">View movement details</summary>
              <dl className="mt-2 space-y-1 break-all text-muted-foreground"><dt>Ledger entry</dt><dd className="font-mono">{tx.id}</dd><dt>Linked reference</dt><dd className="font-mono">{tx.reference_id || 'Legacy record: no linked receipt'}</dd>{tx.operation_id && <><dt>Wallet operation</dt><dd className="font-mono">{tx.operation_id}</dd></>}<dt>Recorded balance after</dt><dd>{tx.balance_after.toLocaleString()} coins</dd></dl>
            </details>
          </div>
        );
      })}
      {activity.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground mt-2"
          disabled={activity.isFetchingNextPage}
          onClick={() => void activity.fetchNextPage()}
        >
          {activity.isFetchingNextPage ? 'Loading…' : 'Load more coin activity'}
        </Button>
      )}
    </div></TabsContent>
  </Tabs>;
};
