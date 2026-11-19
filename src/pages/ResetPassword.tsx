import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { authReturnPath } from '@/lib/authReturnPath';
import {
  clearPendingAuth,
  loadPendingAuth,
  requestPasswordRecovery,
  revokeOtherSessions,
  savePendingAuth,
  updateRecoveredPassword,
  verifyPendingAuth,
} from '@/lib/authFlow';
import { type AuthMethod, authErrorMessage, isValidEmail, maskAuthIdentifier } from '@/lib/authIdentity';

type Step = 'request' | 'code' | 'new-password' | 'success';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isRecoveryUrl = window.location.hash.includes('type=recovery')
    || params.get('type') === 'recovery'
    || params.has('code');
  const returnTo = authReturnPath(location.search);
  const restoredFlow = loadPendingAuth('recovery');
  const [method, setMethod] = useState<AuthMethod>(params.get('method') === 'phone' ? 'phone' : restoredFlow?.method ?? 'email');
  const [step, setStep] = useState<Step>(restoredFlow ? 'code' : 'request');
  const [flow, setFlow] = useState(restoredFlow);
  const [email, setEmail] = useState(restoredFlow?.method === 'email' ? restoredFlow.identifier : '');
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+251');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStep('new-password');
    });

    supabase.auth.getSession().then(({ data }) => {
      if (isRecoveryUrl && data.session) setStep('new-password');
    });

    return () => subscription.unsubscribe();
  }, [isRecoveryUrl]);

  const resendSeconds = useMemo(() => {
    if (!flow) return 0;
    return Math.max(0, 60 - Math.floor((now - flow.lastSentAt) / 1_000));
  }, [flow, now]);

  const requestCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isLoading) return;
    if (method === 'email' && !isValidEmail(email)) {
      toast({ title: 'Invalid email', description: 'Enter a valid email address.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error, identifier } = await requestPasswordRecovery(method, method === 'email' ? email : phone, dialCode);
      if (error) throw error;
      const pending = savePendingAuth({ kind: 'recovery', method, identifier, returnTo });
      setFlow(pending);
      setNow(Date.now());
      setStep('code');
      toast({
        title: method === 'email' ? 'Recovery email sent' : 'Recovery SMS sent',
        description: 'Enter the six-digit code to continue.',
      });
    } catch (error) {
      toast({ title: 'Could not send recovery code', description: authErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!flow || isLoading) return;
    if (!/^\d{6}$/.test(code)) {
      toast({ title: 'Invalid code', description: 'Enter the six-digit recovery code.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await verifyPendingAuth(flow, code);
      if (error) throw error;
      if (!data.session) throw new Error('The recovery code did not create a secure session.');
      setStep('new-password');
      toast({ title: 'Code verified', description: 'Choose your new password.' });
    } catch (error) {
      toast({ title: 'Verification failed', description: authErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const resendRecovery = async () => {
    if (!flow || isLoading || resendSeconds > 0) return;
    setIsLoading(true);
    try {
      const { error } = await requestPasswordRecovery(flow.method, flow.identifier);
      if (error) throw error;
      const updated = savePendingAuth({ ...flow, lastSentAt: Date.now() });
      setFlow(updated);
      setNow(Date.now());
      toast({ title: 'New recovery code sent' });
    } catch (error) {
      toast({ title: 'Could not resend code', description: authErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    if (password.length < 8) {
      toast({ title: 'Password too short', description: 'Use at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirmation) {
      toast({ title: "Passwords don't match", description: 'Enter the same password twice.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await updateRecoveredPassword(password);
      if (error) throw error;
      const revokeResult = await revokeOtherSessions();
      if (revokeResult.error) console.warn('Other sessions could not be revoked:', revokeResult.error.code);
      clearPendingAuth();
      window.history.replaceState({}, document.title, window.location.pathname);
      setStep('success');
    } catch (error) {
      toast({ title: 'Could not update password', description: authErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const finish = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
  };

  const resetRequest = () => {
    clearPendingAuth();
    setFlow(null);
    setCode('');
    setStep('request');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-tertiary/30 via-background to-secondary/20 p-4 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        <header className="relative space-y-4 text-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)} className="absolute left-0 top-0" aria-label="Back to sign in">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-card text-primary"><KeyRound className="size-5" /></div>
          <div>
            <h1 className="text-xl font-semibold">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Verify your account before choosing a new password</p>
          </div>
        </header>

        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {step === 'request' && (
            <form onSubmit={requestCode} className="space-y-4">
              <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Recovery method">
                {(['email', 'phone'] as const).map((item) => (
                  <button key={item} type="button" role="tab" aria-selected={method === item} onClick={() => setMethod(item)} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium ${method === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                    {item === 'email' ? <Mail className="size-4" /> : <Phone className="size-4" />}
                    {item === 'email' ? 'Email' : 'Phone'}
                  </button>
                ))}
              </div>

              {method === 'email' ? (
                <div className="space-y-1.5"><Label htmlFor="recovery-email">Email address</Label><Input id="recovery-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="recovery-phone">Phone number</Label>
                  <div className="grid grid-cols-[92px_1fr] gap-2">
                    <Input aria-label="Country calling code" inputMode="tel" value={dialCode} onChange={(event) => setDialCode(event.target.value)} />
                    <Input id="recovery-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(event) => setPhone(event.target.value)} required />
                  </div>
                </div>
              )}

              <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-xl">{isLoading ? 'Sending…' : `Send ${method === 'email' ? 'email' : 'SMS'} code`}</Button>
            </form>
          )}

          {step === 'code' && flow && (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="text-center">
                <h2 className="font-semibold">Check your {flow.method === 'email' ? 'email' : 'messages'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Code sent to {maskAuthIdentifier(flow.method, flow.identifier)}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-code">Six-digit recovery code</Label>
                <Input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="h-14 text-center font-mono text-2xl tracking-[0.4em]" required autoFocus />
              </div>
              <Button type="submit" disabled={isLoading || code.length !== 6} className="h-11 w-full rounded-xl">{isLoading ? 'Verifying…' : 'Verify code'}</Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={resetRequest} className="text-muted-foreground hover:text-foreground">Change {flow.method}</button>
                <button type="button" disabled={isLoading || resendSeconds > 0} onClick={resendRecovery} className="font-medium text-primary disabled:text-muted-foreground">{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}</button>
              </div>
            </form>
          )}

          {step === 'new-password' && (
            <form onSubmit={savePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="pr-11" required autoFocus />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((value) => !value)} className="absolute right-0 top-0 size-10" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-password">Confirm new password</Label>
                <div className="relative">
                  <Input id="confirm-new-password" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="pr-11" required />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowConfirmation((value) => !value)} className="absolute right-0 top-0 size-10" aria-label={showConfirmation ? 'Hide confirmation password' : 'Show confirmation password'}>{showConfirmation ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                </div>
              </div>
              <Button type="submit" disabled={isLoading || password.length < 8 || password !== confirmation} className="h-11 w-full rounded-xl">{isLoading ? 'Updating…' : 'Update password'}</Button>
            </form>
          )}

          {step === 'success' && (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-8" /></div>
              <div><h2 className="text-lg font-semibold">Password updated</h2><p className="mt-1 text-sm text-muted-foreground">Other sessions were revoked. Sign in with your new password.</p></div>
              <Button onClick={finish} className="h-11 w-full rounded-xl">Go to sign in</Button>
            </div>
          )}
        </section>

        <div className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" /><span>Your verification code and password are never stored by Serkle.</span></div>
      </div>
    </main>
  );
}

