import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CoinTransaction } from '@/hooks/useCoinWallet';

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
  transactions: CoinTransaction[];
}

export const WalletHistoryTab: React.FC<WalletHistoryTabProps> = ({ transactions }) => {
  const [txPage, setTxPage] = useState(1);
  const PAGE_SIZE = 20;
  const visibleTx = transactions.slice(0, txPage * PAGE_SIZE);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
        No transactions yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visibleTx.map((tx) => {
        const meta = transactionTypeLabels[tx.type] || { label: tx.type, color: 'text-foreground' };
        const isPositive = tx.amount > 0;
        return (
          <div key={tx.id} className="rounded-xl bg-card/40 backdrop-blur-sm border border-border/30 p-3.5 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 bg-card/30 border-border/40', meta.color)}>
                {meta.label}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1 truncate">{tx.description}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
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
        );
      })}
      {visibleTx.length < transactions.length && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground mt-2"
          onClick={() => setTxPage((p) => p + 1)}
        >
          Load {Math.min(PAGE_SIZE, transactions.length - visibleTx.length)} more
        </Button>
      )}
    </div>
  );
};
