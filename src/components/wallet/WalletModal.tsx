import { pendingChapaReference, topUpState } from '@/lib/chapaPayments';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Coins, ArrowUpCircle, ArrowDownCircle, History,
  TrendingUp, TrendingDown, CheckCircle2, ChevronLeft, XCircle
} from 'lucide-react';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { useUser } from '@/contexts/UserContext';
import { WalletHistoryTab } from './WalletHistoryTab';
import { WalletTopUpTab } from './WalletTopUpTab';
import { WalletWithdrawTab } from './WalletWithdrawTab';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { user } = useUser();
  const {
    balance,
    totalEarned,
    totalSpent,
    isWalletLoading,
    initiateTopUp,
    verifyTopUp,
    requestWithdrawal,
    chapaBanks,
    chapaMode,
    isBanksLoading,
  } = useCoinWallet(user?.id);

  // ── Tab state (controlled so we can navigate programmatically) ───────────
  const [activeTab, setActiveTab] = useState<string>('transactions');

  // ── Top-Up modal overlay state ────────────────────────────────────────────
  const [isVerifying, setIsVerifying] = useState(false);
  const [topUpDone, setTopUpDone] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  // ── Lock body scroll when overlay is active ───────────────────────────────
  useEffect(() => {
    if (topUpDone || topUpError) {
      document.body.classList.add('modal-overlay-open');
    } else {
      document.body.classList.remove('modal-overlay-open');
    }
    return () => document.body.classList.remove('modal-overlay-open');
  }, [topUpDone, topUpError]);

  // ── Auto-verify when user returns from Chapa checkout tab ─────────────────
  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    const pendingRef = pendingChapaReference(user?.id);
    if (!pendingRef || isVerifying) return;

    setIsVerifying(true);
    try {
      const result = await verifyTopUp.mutateAsync({ txRef: pendingRef });
      if (topUpState(result) === 'success') {
        setTopUpDone(true);
        setTopUpError(null);
      } else if(topUpState(result) === 'pending' || topUpState(result) === 'test') {
        setTopUpError(null);
      } else {
        setTopUpError(result.message || 'No credit is available for this payment.');
      }
    } catch (err: any) {
      setTopUpError(err.message || 'Something went wrong during verification.');
    } finally {
      setIsVerifying(false);
    }
  }, [verifyTopUp, isVerifying, user?.id]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [handleVisibilityChange]);

  if (!isOpen) return null;

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          MAIN WALLET MODAL — uses 100dvh for iPhone PWA compatibility
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="fixed inset-0 z-[100] animate-fade-in isolate flex flex-col"
        style={{ height: '100dvh' }}
      >
        {/* Solid background */}
        <div className="absolute inset-0 bg-background" />

        {/* Ambient glow in brand colors */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }}
        />

        {/* Top App Bar */}
        <div
          className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors touch-target py-2 pr-2"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-base font-semibold text-foreground">Wallet</h1>
          <div className="w-16" />
        </div>

        {/* Scrollable content area */}
        <div
          className="relative z-10 flex-1 overflow-y-auto overscroll-contain"
          style={{
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Balance hero */}
          <div className="flex flex-col items-center text-center px-6 pt-8 pb-4 space-y-4">
            <div className="relative">
              <div className="rounded-full p-1 bg-gradient-to-br from-yellow-400/40 to-orange-400/40 backdrop-blur-sm">
                <div className="w-20 h-20 rounded-full bg-card/60 backdrop-blur-sm border-2 border-background/60 flex items-center justify-center">
                  <Coins className="w-10 h-10 text-yellow-500" />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Coin Balance</p>
              {isWalletLoading ? (
                <SerkleLoader label="Loading balance" className="py-3" />
              ) : (
                <>
                  <p className="text-4xl font-bold text-foreground">{balance.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">= {balance.toLocaleString()} ETB</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30">
                <TrendingUp className="w-4 h-4 text-green-500 mb-1" />
                {isWalletLoading ? (
                  <SerkleLoader size="xs" label="Loading balance" className="mb-1" />
                ) : (
                  <span className="text-sm font-semibold text-foreground">{totalEarned.toLocaleString()}</span>
                )}
                <span className="text-[10px] text-muted-foreground">Earned</span>
              </div>
              <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30">
                <TrendingDown className="w-4 h-4 text-red-500 mb-1" />
                {isWalletLoading ? (
                  <SerkleLoader size="xs" label="Loading balance" className="mb-1" />
                ) : (
                  <span className="text-sm font-semibold text-foreground">{totalSpent.toLocaleString()}</span>
                )}
                <span className="text-[10px] text-muted-foreground">Spent</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 pb-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-card/50 backdrop-blur-sm border border-border/30 rounded-xl">
                <TabsTrigger value="transactions" className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <History className="w-3.5 h-3.5" /> History
                </TabsTrigger>
                <TabsTrigger
                  value="topup"
                  className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" /> Top Up
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  <ArrowDownCircle className="w-3.5 h-3.5" /> Withdraw
                </TabsTrigger>
              </TabsList>

              {/* ── HISTORY TAB ──────────────────────────────────────── */}
              <TabsContent value="transactions" className="mt-3">
                <WalletHistoryTab userId={user?.id} check={verifyTopUp} />
              </TabsContent>

              {/* ── TOP UP TAB ────────────────────────────────────────── */}
              <TabsContent value="topup" className="mt-3">
                <WalletTopUpTab
                  user={user}
                  initiateTopUp={initiateTopUp}
                  verifyTopUp={verifyTopUp}
                  isVerifying={isVerifying}
                  setIsVerifying={setIsVerifying}
                  setTopUpDone={setTopUpDone}
                  setTopUpError={setTopUpError}
                />
              </TabsContent>

              {/* ── WITHDRAW TAB ──────────────────────────────────────── */}
              <TabsContent value="withdraw" className="mt-3">
                <WalletWithdrawTab
                  balance={balance}
                  chapaBanks={chapaBanks}
                  mode={chapaMode}
                  isBanksLoading={isBanksLoading}
                  requestWithdrawal={requestWithdrawal}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SUCCESS OVERLAY — position: fixed, completely covers viewport
          ═══════════════════════════════════════════════════════════════════ */}
      {topUpDone && (
        <div
          className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300"
          style={{ height: '100dvh' }}
        >
          <div className="flex flex-col items-center max-w-sm w-full">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
                <CheckCircle2 className="w-14 h-14 text-green-500" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground text-center mb-8">
              Your coins have been added to your wallet.
            </p>

            <div className="w-full space-y-3">
              <div className="p-4 rounded-2xl bg-card border border-border/40 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">New Balance</span>
                <span className="text-xl font-bold text-primary flex items-center gap-1.5">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  {balance.toLocaleString()}
                </span>
              </div>
              <Button
                variant="outline"
                className="w-full h-11 rounded-2xl text-sm border-border/40"
                onClick={() => {
                  setTopUpDone(false);
                  setActiveTab('transactions');
                }}
              >
                <History className="w-4 h-4 mr-2" />
                View Transaction History
              </Button>
              <Button
                onClick={() => setTopUpDone(false)}
                className="w-full h-14 rounded-2xl text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 touch-target-large"
              >
                Awesome!
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ERROR OVERLAY — position: fixed, completely covers viewport
          ═══════════════════════════════════════════════════════════════════ */}
      {topUpError && (
        <div
          className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300"
          style={{ height: '100dvh' }}
        >
          <div className="flex flex-col items-center max-w-sm w-full">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-14 h-14 text-red-500" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Incomplete</h2>
            <p className="text-muted-foreground text-center mb-8 text-sm">
              {topUpError}
            </p>

            <div className="w-full space-y-3">
              <Button
                onClick={() => setTopUpError(null)}
                className="w-full h-14 rounded-2xl text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 touch-target-large"
              >
                Try Again
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setTopUpError(null);
                  onClose();
                }}
                className="w-full h-11 rounded-2xl text-sm text-muted-foreground"
              >
                Close Wallet
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletModal;
