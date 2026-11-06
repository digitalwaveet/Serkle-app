import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CIRCLE_ACCESS_QUERY_KEYS } from '@/lib/circlePayments';
import { CHAPA_RETURN_URL, chapaRequestKey, pendingChapaKey, recordTopUpResult, topUpState, readChapaStorage, writeChapaStorage, clearChapaStorage, withdrawalFingerprint, withdrawalRequestKey, withdrawalReferenceKey } from '@/lib/chapaPayments';
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
  operation_id?: string | null;
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

  const { data: wallet, isLoading: isWalletLoading, isError: isWalletError } = useQuery({
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
    queryClient.invalidateQueries({ queryKey: ['wallet-payments', userId] });
    queryClient.invalidateQueries({ queryKey: ['wallet-activity', userId] });
    queryClient.invalidateQueries({ queryKey: ['wallet-payment-receipt', userId] });
  };

  // ─── TOP UP: Initiate Chapa checkout ─────────────────────────────────────
  const initiateTopUp = useMutation({
    mutationFn: async ({ 
      amount, 
      email, 
      firstName, 
      lastName,
      phoneNumber
    }: { 
      amount: number; 
      email?: string; 
      firstName?: string; 
      lastName?: string; 
      phoneNumber?: string;
    }) => {
      if (!userId) throw new Error('Please sign in');
      const configuration=await callEdgeFunction('chapa-transfer?action=configuration',null,'GET');
      if(configuration.userId!==userId || activeAccount.current!==userId || !['live','test'].includes(configuration.mode)) throw new Error('Payment configuration could not be confirmed. Refresh the wallet before continuing.');
      const key=chapaRequestKey(userId,amount,configuration.mode);
      let requestId=readChapaStorage(key);
      if(!requestId) {requestId=crypto.randomUUID();writeChapaStorage(key,requestId);}
      const result=await callEdgeFunction('chapa-initialize', { amount, email, firstName, lastName, phoneNumber, returnUrl: CHAPA_RETURN_URL, requestId });
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
    mutationFn: async ({ txRef }: { txRef?: string }) => {
      if (!userId) throw new Error('Please sign in');
      const result=await callEdgeFunction('chapa-verify', txRef ? { txRef } : {});
      if(result.userId!==userId || activeAccount.current!==userId) throw new Error('Your account changed. Check this payment from the correct account.');
      return result;
    },
    onSuccess: (data) => {
      if(data.userId!==activeAccount.current) return;
      invalidate();
      if(data.status==='selection_required' || data.status==='unknown') return;
      if(userId) recordTopUpResult(userId,data);
      if(data.kind==='withdrawal') {
        toast({title:data.mode==='test' ? 'Test withdrawal status' : 'Withdrawal status',description:data.message || 'Open this receipt for the latest recorded status.'});
        return;
      }
      const state=topUpState(data);
      if (state === 'success') {
        CIRCLE_ACCESS_QUERY_KEYS.forEach(key=>queryClient.invalidateQueries({queryKey:[key]}));
        toast({
          title: '🎉 Top-up successful!',
          description: `${data.amount} coins have been added to your wallet.`,
        });
      } else if (state === 'test') {
        toast({ title: 'Test payment successful', description: data.message || 'Chapa confirmed the test payment. No spendable coins were added.' });
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
      if (!userId || typeSent !== 'tip_sent' || typeReceived !== 'tip_received' || !Number.isSafeInteger(amount) || amount<1) throw new Error('A tip must use a supported transfer type and a positive whole-coin amount');
      const fingerprint=await withdrawalFingerprint(amount,0,receiverId,`${referenceId || ''}:${description || ''}`);
      const key=`wallet-tip:${userId}:${fingerprint}`;
      let requestId=readChapaStorage(key);
      if(!requestId) {requestId=crypto.randomUUID();writeChapaStorage(key,requestId);}
      const { data, error } = await supabase.rpc('wallet_transfer_tip' as any, {
        _request_id: requestId,
        _receiver_id: receiverId,
        _amount: amount,
        _reference_id: referenceId || null,
        _description: description || '',
      });
      if (error) throw error;
      if ((data as any)?.userId !== userId || activeAccount.current !== userId) throw new Error('Your account changed. Check the transfer from the correct account.');
      // A confirmed response ends this explicit attempt. Unknown network results
      // keep their key, so the next click replays the same server operation.
      if(readChapaStorage(key)===requestId) clearChapaStorage(key);
      if (!(data as any)?.success) throw new Error('Insufficient coin balance');
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (err: any) => {
      toast({ title: 'Transaction failed', description: err.message, variant: 'destructive' });
    },
  });

  // ─── WITHDRAW: Via Chapa bank transfer ───────────────────────────────────
  const requestWithdrawal = useMutation({
    mutationFn: async ({
      amount,
      accountName,
      accountNumber,
      bankCode,
      expectedMode,
    }: {
      amount: number;
      accountName?: string;
      accountNumber?: string;
      bankCode?: number;
      payoutMethod?: string;
      expectedMode?: 'live' | 'test';
    }) => {
      if (!userId || !accountName || !accountNumber || !bankCode) throw new Error('Sign in and review the bank account before requesting a withdrawal.');
      const configuration=await callEdgeFunction('chapa-transfer?action=configuration',null,'GET');
      if(configuration.userId!==userId || activeAccount.current!==userId || configuration.mode!==expectedMode) throw new Error('Payment mode changed. Refresh the wallet and review the withdrawal before confirming.');
      const fingerprint=await withdrawalFingerprint(amount,bankCode,accountNumber,accountName);
      const key=withdrawalRequestKey(userId,fingerprint,configuration.mode);
      let requestId=readChapaStorage(key);
      if(!requestId) {requestId=crypto.randomUUID();writeChapaStorage(key,requestId);}
      const data=await callEdgeFunction('chapa-transfer',{amount,accountName,accountNumber,bankCode,expectedMode,requestId});
      if(data.userId!==userId || activeAccount.current!==userId) throw new Error('Your account changed. Open the withdrawal receipt from the correct account.');
      if(data.txRef) writeChapaStorage(withdrawalReferenceKey(userId,data.txRef),key);
      recordTopUpResult(userId,data);
      return data;
    },
    onSuccess: (data) => {
      if(data.userId!==activeAccount.current) return;
      invalidate();
      toast({
        title: data.mode==='test' ? 'Test withdrawal recorded' : data.status==='failed' ? 'Withdrawal not completed' : 'Withdrawal recorded',
        description: data.message || 'Open the saved receipt to check its status.',
      });
    },
    onError: (err: any) => {
      invalidate();
      toast({ title: 'Withdrawal needs attention', description: err.message, variant: 'destructive' });
      queryClient.invalidateQueries({queryKey:['chapa-banks',userId]});
    },
  });

  // ─── BANKS: Fetch available Chapa banks ──────────────────────────────────
  const { data: chapaBankData, isLoading: isBanksLoading, isError: isBanksError, refetch: retryBanks } = useQuery({
    queryKey: ['chapa-banks',userId],
    enabled: !!userId,
    queryFn: async (): Promise<{banks:ChapaBank[];mode:'test'|'live'}> => {
      const data = await callEdgeFunction('chapa-transfer', null, 'GET');
      if(data.userId!==userId || !['live','test'].includes(data.mode)) throw new Error('Wallet configuration could not be confirmed');
      return {banks:data.banks ?? [],mode:data.mode};
    },
    staleTime: 60000,
    refetchOnMount: 'always',
  });

  return {
    wallet,
    balance: wallet?.balance ?? 0,
    totalEarned: wallet?.total_earned ?? 0,
    totalSpent: wallet?.total_spent ?? 0,
    transactions: transactions ?? [],
    isWalletLoading,
    isWalletError,
    isTransactionsLoading,
    initiateTopUp,
    verifyTopUp,
    transferCoins,
    requestWithdrawal,
    chapaBanks: chapaBankData?.banks ?? [],
    chapaMode: chapaBankData?.mode,
    isBanksLoading,
    isBanksError,
    retryBanks,
    invalidate,
  };
}
