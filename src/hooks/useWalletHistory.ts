import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { walletPage, type WalletMode, type WalletCursor, type WalletPayment, type WalletAuditEvent } from '@/lib/walletHistory';
import type { CoinTransaction } from '@/hooks/useCoinWallet';

const PAGE_SIZE = 20;
async function walletRpc(name: string, args: Record<string, unknown>, userId: string) {
  const { data, error } = await supabase.rpc(name as any, args);
  if (error) throw error;
  if ((data as any)?.userId !== userId) throw new Error('Your account changed. Reopen the wallet for the current account.');
  return data as any;
}
const cursorArgs = (cursor?: WalletCursor) => ({ _before_created_at: cursor?.created_at || null, _before_id: cursor?.id || null });

export function useWalletPayments(userId: string | undefined, mode: WalletMode) {
  return useInfiniteQuery({ queryKey: ['wallet-payments', userId, mode], enabled: !!userId,
    initialPageParam: undefined as WalletCursor | undefined, staleTime: 0, refetchInterval: 30000,
    queryFn: async ({ pageParam }) => {
      const data = await walletRpc('get_wallet_payment_history', { ...cursorArgs(pageParam), _limit: PAGE_SIZE, _mode: mode }, userId!);
      return { ...walletPage<WalletPayment>(data.items || [], PAGE_SIZE), automaticChecks: data.automaticChecks as Record<'test' | 'live', string | null> };
    }, getNextPageParam: last => last.next,
  });
}
export function useWalletActivity(userId?: string) {
  return useInfiniteQuery({ queryKey: ['wallet-activity', userId], enabled: !!userId,
    initialPageParam: undefined as WalletCursor | undefined, staleTime: 0,
    queryFn: async ({ pageParam }) => {
      const data = await walletRpc('get_wallet_activity', { ...cursorArgs(pageParam), _limit: PAGE_SIZE }, userId!);
      return { ...walletPage<CoinTransaction>(data.items || [], PAGE_SIZE), integrity: data.integrity as {status:string;recordedBalance:number;expectedBalance:number;baselineAt:string|null} };
    }, getNextPageParam: last => last.next,
  });
}
export function useWalletReceipt(userId: string | undefined, paymentId: string | null) {
  return useInfiniteQuery({ queryKey: ['wallet-payment-receipt', userId, paymentId], enabled: !!userId && !!paymentId,
    initialPageParam: undefined as WalletCursor | undefined, staleTime: 0,
    queryFn: async ({ pageParam }) => {
      const data = await walletRpc('get_wallet_payment_receipt', { _payment_id: paymentId, ...cursorArgs(pageParam), _limit: PAGE_SIZE }, userId!);
      return { payment: data.payment as WalletPayment, ledger: data.ledger as CoinTransaction[], ...walletPage<WalletAuditEvent>(data.events || [], PAGE_SIZE) };
    }, getNextPageParam: last => last.next,
  });
}
