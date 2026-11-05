import { pendingChapaReference, topUpState, type ChapaRecoveryCandidate, type VerifiedTopUp } from '@/lib/chapaPayments';
import { circleLoginPath } from '@/lib/authReturnPath';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCoinWallet } from "@/hooks/useCoinWallet";
import { useUser } from "@/contexts/UserContext";
import { CheckCircle2, XCircle, Coins, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const VerifyTopUp = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useUser();
  const { verifyTopUp, balance } = useCoinWallet(user?.id);
  const [status, setStatus] = useState<'verifying' | 'pending' | 'success' | 'test' | 'selection' | 'unknown' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [payment, setPayment] = useState<VerifiedTopUp | null>(null);
  const [candidates, setCandidates] = useState<ChapaRecoveryCandidate[]>([]);
  const [attempt, setAttempt] = useState(0);
  const lastCheck = useRef<{ userId: string; txRef: string; attempt: number } | null>(null);

  const isIframe = window !== window.parent;
  const urlRef = searchParams.get('tx_ref') || searchParams.get('trx_ref') || searchParams.get('verify_topup');
  // Verification/reconciliation clears pending storage. Keep this page's receipt
  // stable so a successful check cannot turn into a missing-reference error.
  const storedRef = useMemo(() => pendingChapaReference(user?.id), [user?.id]);
  const txRef = urlRef || storedRef;
  const verifyPayment = verifyTopUp.mutateAsync;

  useEffect(() => {
    if(!isAuthLoading && !user) navigate(circleLoginPath(txRef ? `/verify?tx_ref=${encodeURIComponent(txRef)}` : '/verify'),{replace:true});
  },[isAuthLoading,user?.id,txRef,navigate]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthLoading || !user?.id) return;
    if (txRef && lastCheck.current?.userId === user.id && lastCheck.current.txRef === txRef && lastCheck.current.attempt === attempt) return;
    setStatus('verifying');
    setErrorMsg(null);
    setCandidates([]);
    setPayment(null);

    const verify = async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Timeout promise to prevent infinite hanging
        const timeoutPromise = new Promise<VerifiedTopUp>((_, reject) =>
          timer=setTimeout(() => reject(new Error('Verification request timed out. Please try again later.')), 30000)
        );
        
        const result: VerifiedTopUp = await Promise.race([
          verifyPayment(txRef ? { txRef } : {}),
          timeoutPromise
        ]);

        if (!isMounted) return;
        setPayment(result);
        if (result.txRef) {
          lastCheck.current = { userId: user.id, txRef: result.txRef, attempt };
          if (!urlRef) setSearchParams({ tx_ref: result.txRef }, { replace: true });
        }

        if (result.status === 'selection_required') {
          setCandidates(result.candidates || []);
          setStatus('selection');
        } else if (result.status === 'unknown') {
          setErrorMsg(result.message || 'We could not identify this payment. Check your wallet history or contact support with your Chapa receipt.');
          setStatus('unknown');
        } else if (topUpState(result) === 'success') {
          setStatus('success');
          if (isIframe) {
            window.parent.postMessage({ 
              type: 'CHAPA_PAYMENT_RECHECK', 
              txRef: result.txRef
            }, window.location.origin);
          }
        } else if (topUpState(result) === 'test') {
          setStatus('test');
        } else if (topUpState(result) === 'pending') {
          setStatus('pending');
        } else {
          setStatus('error');
          const msg = result?.message || 'Verification failed. Payment not completed.';
          setErrorMsg(msg);
          if (isIframe) {
            window.parent.postMessage({ 
              type: 'CHAPA_PAYMENT_RECHECK', 
              message: msg,
              txRef 
            }, window.location.origin);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('error');
        const msg = err.message || 'Something went wrong during verification.';
        setErrorMsg(msg);
        if (isIframe) {
          window.parent.postMessage({ 
            type: 'CHAPA_PAYMENT_RECHECK', 
            message: msg,
            txRef 
          }, window.location.origin);
        }
      } finally {
        clearTimeout(timer);
      }
    };

    verify();
    
    return () => {
      isMounted = false;
    };
  }, [txRef, urlRef, user?.id, isAuthLoading, attempt, verifyPayment, setSearchParams]);

  const handleGoHome = () => {
    navigate('/?wallet=open');
  };


  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-md bg-card border border-border/40 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative background blur */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-secondary/10 blur-[100px] rounded-full" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {status === 'verifying' && (
            <>
              <div className="h-20 px-4 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <SerkleLoader size="md" className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Verifying Payment</h1>
              <p className="text-muted-foreground">
                Please wait while we confirm your transaction with Chapa.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-success/20 blur-3xl rounded-full" />
                <div className="relative w-24 h-24 rounded-full bg-success/10 flex items-center justify-center border-4 border-success animate-bounce-short">
                  <CheckCircle2 className="w-12 h-12 text-success" />
                </div>
              </div>
              <h1 className="text-3xl font-black text-foreground mb-3">Payment Successful!</h1>
              <p className="text-muted-foreground mb-8">
                Your coins have been added to your wallet. You're all set to explore Serkle!
              </p>
              
              <div className="w-full p-5 rounded-3xl bg-primary/5 border border-primary/10 flex items-center justify-between mb-8">
                <div className="text-left">
                  <p className="text-sm text-muted-foreground font-medium">New Balance</p>
                  <p className="text-2xl font-bold text-primary flex items-center gap-2 mt-0.5">
                    <Coins className="w-6 h-6 text-yellow-500 fill-yellow-500/20" />
                    {balance.toLocaleString()}
                  </p>
                </div>
                <div className="bg-success/20 p-2 rounded-xl">
                  <div className="text-[10px] font-bold text-success uppercase tracking-wider">Verified</div>
                </div>
              </div>

              <Button 
                onClick={handleGoHome}
                className="w-full h-16 rounded-2xl text-lg font-bold bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.02] transition-transform shadow-lg shadow-primary/25"
              >
                Go to My Wallet
              </Button>
            </>
          )}

          {status === 'test' && <>
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/25">
                <CheckCircle2 className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Test payment successful</h1>
            {typeof payment?.amount === 'number' && <p className="text-lg font-semibold mb-3">{payment.amount.toLocaleString()} ETB test payment</p>}
            <p className="text-muted-foreground mb-6">Chapa confirmed this test payment. Test mode does not add spendable coins to your wallet.</p>
            <Button onClick={handleGoHome}>Go to My Wallet</Button>
          </>}
          {status === 'selection' && <>
            <h1 className="text-2xl font-bold mb-2">Choose the payment to check</h1>
            <p className="text-muted-foreground mb-6">We found several recent payments on your account. Select the one from your Chapa receipt.</p>
            <div className="w-full space-y-3">
              {candidates.map(candidate => <Button key={candidate.txRef} variant="outline" className="w-full h-auto py-3 flex-col gap-1"
                onClick={() => setSearchParams({ tx_ref: candidate.txRef }, { replace: true })}>
                <span>Check {candidate.amount.toLocaleString()} ETB payment</span>
                {candidate.createdAt && <span className="text-xs text-muted-foreground">{new Date(candidate.createdAt).toLocaleString()}</span>}
                <span className="text-xs font-mono break-all whitespace-normal">{candidate.txRef}</span>
              </Button>)}
              <Button variant="ghost" onClick={handleGoHome}>Go to wallet</Button>
            </div>
          </>}
          {status === 'unknown' && <>
            <h1 className="text-2xl font-bold mb-2">Payment needs verification</h1>
            <p className="text-muted-foreground mb-6">{errorMsg}</p>
            <Button onClick={() => setAttempt(value => value + 1)}>Check payment status</Button>
            <Button variant="ghost" onClick={handleGoHome}>Go to wallet</Button>
          </>}
          {status === 'pending' && <>
            <h1 className="text-2xl font-bold mb-2">Payment pending</h1>
            <p className="text-muted-foreground mb-6">Your payment has not been confirmed yet. Check its status before paying again.</p>
            <Button onClick={() => setAttempt(value => value + 1)}>Check payment status</Button>
            <Button variant="ghost" onClick={handleGoHome}>Go to wallet</Button>
          </>}
          {status === 'error' && (
            <>
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-destructive/20 blur-3xl rounded-full" />
                <div className="relative w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center border-4 border-destructive animate-in shake duration-500">
                  <XCircle className="w-12 h-12 text-destructive" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Unable to verify payment</h1>
              <p className="text-muted-foreground mb-8 max-w-[280px]">
                {errorMsg} Check this payment's status before starting another payment.
              </p>
              
              <div className="w-full space-y-3">
                <Button 
                  onClick={() => setAttempt(value => value + 1)}
                  className="w-full h-14 rounded-2xl font-semibold shadow-md"
                >
                  Try Again
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => navigate('/')}
                  className="w-full h-14 rounded-2xl text-muted-foreground flex items-center justify-center gap-2 hover:bg-muted/50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Home
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      
      <p className="mt-12 text-sm text-muted-foreground flex items-center gap-2">
        Protected by <span className="font-bold text-primary">Chapa</span>
      </p>
    </div>
  );
};

export default VerifyTopUp;
