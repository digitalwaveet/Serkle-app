import { pendingChapaKey, writeChapaStorage } from '@/lib/chapaPayments';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Coins, ArrowRight, ArrowLeft, Shield, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const TOPUP_PRESETS = [10, 25, 50, 100, 250, 500];

type TopUpStep = 'amount' | 'review';

function isValidEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  return trimmed.includes('@') && trimmed.includes('.') && !trimmed.endsWith('@placeholder.com');
}

interface WalletTopUpTabProps {
  user: any;
  initiateTopUp: any;
  verifyTopUp: any;
  isVerifying: boolean;
  setIsVerifying: (v: boolean) => void;
  setTopUpDone: (v: boolean) => void;
  setTopUpError: (err: string | null) => void;
}

export const WalletTopUpTab: React.FC<WalletTopUpTabProps> = ({
  user,
  initiateTopUp,
  verifyTopUp,
  isVerifying,
  setIsVerifying,
  setTopUpDone,
  setTopUpError,
}) => {
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);
  const [customTopUp, setCustomTopUp] = useState('');
  const [topUpStep, setTopUpStep] = useState<TopUpStep>('amount');
  const [tempEmail, setTempEmail] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const finalTopUp = topUpAmount || parseInt(customTopUp) || 0;
  const needsEmail = !isValidEmail(user?.email);

  const handleNext = () => {
    if (finalTopUp < 10) return;

    if (needsEmail) {
      toast({
        title: "Email Required",
        description: "Please enter a valid email address above before proceeding.",
        variant: "destructive",
      });
      return;
    }

    setTopUpStep('review');
  };

  const handleBackToAmount = () => {
    setTopUpStep('amount');
  };

  const handleTopUp = async () => {
    if (finalTopUp < 10) return;

    if (needsEmail) {
      toast({
        title: "Email Required",
        description: "Please enter a valid email address before topping up.",
        variant: "destructive",
      });
      setTopUpStep('amount');
      return;
    }

    const firstName = user?.name?.split(' ')[0] || "User";
    const lastName = user?.name?.split(' ').slice(1).join(' ') || "";

    initiateTopUp.mutate({
      amount: finalTopUp,
      email: user.email,
      firstName,
      lastName,
      phoneNumber: (user as any)?.phone || undefined,
      returnUrl: window.location.origin + '/verify'
    }, {
      onSuccess: (data: any) => {
        if (!data?.checkoutUrl) {
          toast({
            title: "Payment initialization failed",
            description: "No checkout URL returned by Chapa. Please try again.",
            variant: "destructive",
          });
          return;
        }

        // Store pending txRef for automatic verification upon return
        if (data.txRef) {
          writeChapaStorage(pendingChapaKey(user.id), data.txRef);
        }

        // Redirect to Chapa's official secure hosted checkout
        window.location.href = data.checkoutUrl;
      },
      onError: (err: any) => {
        toast({
          title: "Payment Error",
          description: err.message || "Failed to connect to payment gateway.",
          variant: "destructive",
        });
      }
    });
  };

  const handleSaveEmail = async () => {
    const trimmedEmail = tempEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address (e.g. name@example.com).",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ email: trimmedEmail })
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({ email: trimmedEmail });
      if (authError) {
        console.warn('Could not update auth email:', authError.message);
      }

      toast({
        title: "Email Saved",
        description: "Your email has been updated. You can now proceed with payment.",
      });
      setTempEmail('');
    } catch (err: any) {
      console.error('Failed to update email:', err);
      toast({
        title: "Save Failed",
        description: err.message || "Could not save your email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div>
      {/* ── STEP 1: Select Amount ────────────────────────────── */}
      {topUpStep === 'amount' && (
        <div className="space-y-4">
          {needsEmail && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold">
                <Mail className="w-4 h-4 shrink-0" />
                Email required for payments
              </div>
              <p className="text-[11px] text-muted-foreground">
                Chapa requires an email to send payment receipts.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your.email@example.com"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  className="rounded-lg h-8 text-xs bg-background/60"
                />
                <Button
                  size="sm"
                  onClick={handleSaveEmail}
                  disabled={isUpdatingProfile || !tempEmail.trim()}
                  className="rounded-lg h-8 text-xs shrink-0"
                >
                  {isUpdatingProfile ? <SerkleLoader size="xs" className="text-current" /> : 'Save'}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select amount (ETB)</p>
            <div className="grid grid-cols-3 gap-2">
              {TOPUP_PRESETS.map((amt) => {
                const isSelected = topUpAmount === amt;
                return (
                  <button
                    key={amt}
                    onClick={() => {
                      setTopUpAmount(amt);
                      setCustomTopUp('');
                      setTopUpDone(false);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border/40 bg-card/40 hover:bg-card/70 text-foreground'
                    }`}
                  >
                    <span className="text-base font-bold">{amt}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Coins className="w-2.5 h-2.5 text-yellow-500" /> {amt} coins
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom amount</p>
            <Input
              type="number"
              placeholder="Enter ETB amount (min. 10)"
              value={customTopUp}
              onChange={(e) => {
                setCustomTopUp(e.target.value);
                setTopUpAmount(null);
                setTopUpDone(false);
              }}
              min="10"
              max="50000"
              className="rounded-xl bg-card/40 backdrop-blur-sm border-border/30"
            />
          </div>

          {finalTopUp >= 10 && (
            <div className="rounded-xl bg-card/40 backdrop-blur-sm border border-border/30 p-3 flex items-center justify-between animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">You'll receive</span>
              </div>
              <span className="text-sm font-bold text-green-500">+{finalTopUp} coins</span>
            </div>
          )}

          <Button
            onClick={handleNext}
            disabled={finalTopUp < 10 || needsEmail}
            title={needsEmail ? "Please save your email above to continue" : finalTopUp < 10 ? "Minimum 10 ETB" : undefined}
            className="w-full rounded-xl gap-2 bg-gradient-to-r from-primary to-primary/80 touch-target-large"
            size="lg"
          >
            Continue to Review
            <ArrowRight className="w-4 h-4" />
          </Button>

          {needsEmail && finalTopUp >= 10 && (
            <p className="text-xs text-destructive text-center flex items-center justify-center gap-1 mt-1">
              <Mail className="w-3.5 h-3.5" /> Please save your email above to continue
            </p>
          )}

          <div className="rounded-xl bg-card/30 border border-border/20 p-3 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Payments are processed securely via Chapa. Supports Telebirr, CBE Birr, Amhara Bank, and major Ethiopian banks. 1 ETB = 1 coin.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 2: Review & Pay ──────────────────────────────── */}
      {topUpStep === 'review' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
          <button
            onClick={handleBackToAmount}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to amount selection
          </button>

          <div className="rounded-2xl bg-card/40 backdrop-blur-sm border border-border/30 p-5 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center">Order Summary</p>

            <div className="space-y-2.5 py-2 border-y border-border/20">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Top-Up Amount</span>
                <span className="font-semibold text-foreground">{finalTopUp.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Coins Credited</span>
                <span className="font-semibold text-primary flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-yellow-500" />
                  {finalTopUp.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Processing Fee</span>
                <span className="text-muted-foreground font-medium">Free</span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Receipt sent to</span>
                <span className="truncate max-w-[180px] font-mono">{user?.email}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-base font-bold text-foreground">Total Due</span>
              <span className="text-xl font-bold text-foreground">{finalTopUp.toLocaleString()} ETB</span>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleTopUp}
              disabled={initiateTopUp.isPending || isVerifying}
              className="w-full h-14 rounded-2xl text-base font-semibold gap-2 bg-gradient-to-r from-primary to-primary/80 touch-target-large shadow-lg shadow-primary/20"
              size="lg"
            >
              {initiateTopUp.isPending || isVerifying ? (
                <>
                  <SerkleLoader size="xs" className="text-current" />
                  {isVerifying ? 'Verifying payment…' : 'Connecting to Chapa…'}
                </>
              ) : (
                <>
                  Pay {finalTopUp.toLocaleString()} ETB with Chapa
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              You will be redirected to Chapa's secure payment portal.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
