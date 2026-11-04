import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CIRCLE_ACCESS_QUERY_KEYS } from '@/lib/circlePayments';
import { chapaRequestKey, pendingChapaKey, recordTopUpResult, topUpState, readChapaStorage, writeChapaStorage } from '@/lib/chapaPayments';
import { edgeFunctionErrorMessage } from '@/lib/edgeFunctionError';

export interface CoinWallet {
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  reference_id: string | null;
  description: string;
  balance_after: number;
  created_at: string;
}

export interface ChapaBank {
  id: number;
  swift: string;
  name: string;
  acct_length: number;
  country_id: number;
  created_at: string;
  updated_at: string;
}

async function callEdgeFunction(
  name: string,
  body: Record<string, unknown> | null,
  method: 'POST' | 'GET' = 'POST'
) {
  const { data, error } = await supabase.functions.invoke(name, {
    method,
    body: body || undefined,
  });

  if (error) {
    const message = await edgeFunctionErrorMessage(error);
    console.error(`Edge Function ${name} error:`, message);
    throw new Error(message);
  }

  if (!data?.success && !data?.status) {
    // Some functions might not return success: true but are still valid
    // but typically we expect success: true from our custom functions
    console.warn(`Edge Function ${name} returned non-success:`, data);
  }

  return data;
}

export function useCoinWallet(userId?: string) {
  const activeAccount=useRef(userId);
  activeAccount.current=userId;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: wallet, isLoading: isWalletLoading } = useQuery({
    queryKey: ['coin-wallet', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('coin_wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as CoinWallet | null;
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 15000,
  });

  const { data: transactions, isLoading: isTransactionsLoading } = useQuery({
    queryKey: ['coin-transactions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as CoinTransaction[];
    },
    enabled: !!userId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['coin-wallet', userId] });
    queryClient.invalidateQueries({ queryKey: ['coin-transactions', userId] });
  };

  // ─── TOP UP: Initiate Chapa checkout ─────────────────────────────────────
  const initiateTopUp = useMutation({
    mutationFn: async ({ 
      amount, 
      email, 
      firstName, 
      lastName,
      phoneNumber,
      returnUrl
    }: { 
      amount: number; 
      email?: string; 
      firstName?: string; 
      lastName?: string; 
      phoneNumber?: string;
      returnUrl?: string;
    }) => {
      if (!userId) throw new Error('Please sign in');
      const key=chapaRequestKey(userId,amount);
      let requestId=readChapaStorage(key);
      if(!requestId) {requestId=crypto.randomUUID();writeChapaStorage(key,requestId);}
      const result=await callEdgeFunction('chapa-initialize', { amount, email, firstName, lastName, phoneNumber, returnUrl, requestId });
      if(result.userId!==userId || activeAccount.current!==userId) throw new Error('Your account changed. Review this payment from the correct account.');
      if(result.txRef) writeChapaStorage(pendingChapaKey(userId),result.txRef);
      if(!result.checkoutUrl) {
        recordTopUpResult(userId,result);
        invalidate();
        throw new Error(result.message || 'Check your existing payment before starting another top-up.');
      }
      return result;
    },
    onSuccess: (data) => {
      // Store txRef so we can verify if needed
      if(userId && data.userId===activeAccount.current) writeChapaStorage(pendingChapaKey(userId), data.txRef);
      // We no longer window.open here; the component will handle the checkoutUrl
    },
    onError: (err: any) => {
      toast({
        title: 'Could not initiate payment',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // ─── TOP UP: Verify after returning from Chapa ───────────────────────────
  const verifyTopUp = useMutation({
    mutationFn: async ({ txRef }: { txRef: string }) => {
      const result=await callEdgeFunction('chapa-verify', { txRef });
      if(result.userId!==userId || activeAccount.current!==userId) throw new Error('Your account changed. Check this payment from the correct account.');
      return result;
    },
    onSuccess: (data) => {
      if(data.userId!==activeAccount.current) return;
      if(userId) recordTopUpResult(userId,data);
      const state=topUpState(data);
      if (state === 'success') {
        CIRCLE_ACCESS_QUERY_KEYS.forEach(key=>queryClient.invalidateQueries({queryKey:[key]}));
        toast({
          title: '🎉 Top-up successful!',
          description: `${data.amount} coins have been added to your wallet.`,
        });
      } else if (state === 'pending') {
        toast({ title: 'Payment pending', description: 'Verification is pending. Check again before making another payment.' });
      } else {
        toast({
          title: 'No payment credit available',
          description: data.message || 'Check the payment status before paying again.',
          variant: 'destructive',
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Verification failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const transferCoins = useMutation({
    mutationFn: async ({
      receiverId,
      amount,
      typeSent,
      typeReceived,
      referenceId,
      description,
    }: {
      receiverId: string;
      amount: number;
      typeSent: string;
      typeReceived: string;
      referenceId?: string;
      description?: string;
    }) => {
      const { data, error } = await supabase.rpc('transfer_coins', {
        _sender_id: userId!,
        _receiver_id: receiverId,
        _amount: amount,
        _type_sent: typeSent as any,
        _type_received: typeReceived as any,
        _reference_id: referenceId || null,
        _description: description || '',
      });
      if (error) throw error;
      if (!data) throw new Error('Insufficient coin balance');
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (err: any) => {
      toast({ title: 'Transaction failed', description: err.message, variant: 'destructive' });
    },
  });

  const spendCoins = useMutation({
    mutationFn: async ({
      amount,
      type,
      referenceId,
      description,
    }: {
      amount: number;
      type: string;
      referenceId?: string;
      description?: string;
    }) => {
      const { data, error } = await supabase.rpc('spend_coins', {
        _user_id: userId!,
        _amount: amount,
        _type: type as any,
        _reference_id: referenceId || null,
        _description: description || '',
      });
      if (error) throw error;
      if (!data) throw new Error('Insufficient coin balance');
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (err: any) => {
      toast({ title: 'Payment failed', description: err.message, variant: 'destructive' });
    },
  });

  // ─── WITHDRAW: Via Chapa bank transfer ───────────────────────────────────
  const requestWithdrawal = useMutation({
    mutationFn: async ({
      amount,
      accountName,
      accountNumber,
      bankCode,
    }: {
      amount: number;
      accountName?: string;
      accountNumber?: string;
      bankCode?: number;
      payoutMethod?: string;
    }) => {
      // If bank details provided → real Chapa transfer
      if (accountName && accountNumber && bankCode) {
        return callEdgeFunction('chapa-transfer', {
          amount,
          accountName,
          accountNumber,
          bankCode,
        });
      }
      // Fallback: direct Supabase RPC (demo)
      const { data, error } = await supabase.rpc('request_withdrawal', {
        _user_id: userId!,
        _amount: amount,
        _payout_method: 'bank_transfer',
      });
      if (error) throw error;
      if (!data) throw new Error('Insufficient balance for withdrawal');
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: '✅ Withdrawal requested',
        description: 'Your request is being processed (3-5 business days).',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Withdrawal failed', description: err.message, variant: 'destructive' });
    },
  });

  // ─── BANKS: Fetch available Chapa banks ──────────────────────────────────
  const { data: chapaBanks, isLoading: isBanksLoading } = useQuery({
    queryKey: ['chapa-banks'],
    queryFn: async (): Promise<ChapaBank[]> => {
      try {
        const data = await callEdgeFunction('chapa-transfer', null, 'GET');
        return data.banks ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  return {
    wallet,
    balance: wallet?.balance ?? 0,
    totalEarned: wallet?.total_earned ?? 0,
    totalSpent: wallet?.total_spent ?? 0,
    transactions: transactions ?? [],
    isWalletLoading,
    isTransactionsLoading,
    initiateTopUp,
    verifyTopUp,
    transferCoins,
    spendCoins,
    requestWithdrawal,
    chapaBanks: chapaBanks ?? [],
    isBanksLoading,
    invalidate,
  };
}
