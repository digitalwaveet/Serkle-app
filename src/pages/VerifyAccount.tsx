import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Mail, MessageSquareText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  clearPendingAuth,
  loadPendingAuth,
  resendPendingSignup,
  savePendingAuth,
  verifyPendingAuth,
} from '@/lib/authFlow';
import { authErrorMessage, maskAuthIdentifier } from '@/lib/authIdentity';

const RESEND_WAIT_SECONDS = 60;

export default function VerifyAccount() {
  const navigate = useNavigate();
  const [flow, setFlow] = useState(() => loadPendingAuth('signup'));
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const resendSeconds = useMemo(() => {
    if (!flow) return 0;
    return Math.max(0, RESEND_WAIT_SECONDS - Math.floor((now - flow.lastSentAt) / 1_000));
  }, [flow, now]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!flow || isVerifying) return;
    if (!/^\d{6}$/.test(code)) {
      toast({ title: 'Enter the complete code', description: 'The verification code contains six digits.', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await verifyPendingAuth(flow, code);
      if (error) throw error;
      if (!data.session) throw new Error('Verification succeeded, but no secure session was created. Please sign in.');
      const destination = flow.returnTo || '/';
      clearPendingAuth();
      toast({ title: 'Account verified', description: 'Welcome to Serkle.' });
      navigate(destination, { replace: true });
    } catch (error) {
      toast({ title: 'Verification failed', description: authErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const resend = async () => {
    if (!flow || isResending || resendSeconds > 0) return;
    setIsResending(true);
    try {
      const { error } = await resendPendingSignup(flow);
      if (error) throw error;
      const updated = savePendingAuth({ ...flow, lastSentAt: Date.now() });
      setFlow(updated);
      setNow(Date.now());
      toast({ title: 'New code sent', description: flow.method === 'email' ? 'Check your email inbox.' : 'Check your SMS messages.' });
    } catch (error) {
      toast({ title: 'Could not resend code', description: authErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsResending(false);
    }
  };

  if (!flow) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <section className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BadgeCheck className="size-7" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">No verification is pending</h1>
            <p className="mt-1 text-sm text-muted-foreground">Start signup again to request a fresh verification code.</p>
          </div>
          <Button onClick={() => navigate('/signup', { replace: true })} className="w-full">Go to signup</Button>
          <Button variant="ghost" onClick={() => navigate('/login', { replace: true })} className="w-full">Back to sign in</Button>
        </section>
      </main>
    );
  }

  const Icon = flow.method === 'email' ? Mail : MessageSquareText;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-tertiary/30 via-background to-secondary/20 p-4">
      <section className="w-full max-w-md space-y-6">
        <Button variant="ghost" size="sm" onClick={() => { clearPendingAuth(); navigate(`/signup?returnTo=${encodeURIComponent(flow.returnTo)}`); }} className="gap-2">
          <ArrowLeft className="size-4" /> Change {flow.method}
        </Button>

        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Verify your {flow.method}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enter the six-digit code sent to <span className="font-medium text-foreground">{maskAuthIdentifier(flow.method, flow.identifier)}</span>.
            </p>
          </div>

          <form onSubmit={verify} className="space-y-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification code</Label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
                autoFocus
                required
              />
            </div>
            <Button type="submit" disabled={isVerifying || code.length !== 6} className="h-11 w-full rounded-xl">
              {isVerifying ? 'Verifying…' : 'Verify and continue'}
            </Button>
          </form>

          <div className="border-t border-border pt-4 text-sm">
            <p className="text-muted-foreground">Didn’t receive the code?</p>
            <button type="button" onClick={resend} disabled={isResending || resendSeconds > 0} className="mt-1 font-medium text-primary disabled:cursor-not-allowed disabled:text-muted-foreground">
              {isResending ? 'Sending…' : resendSeconds > 0 ? `Send again in ${resendSeconds}s` : 'Send a new code'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

