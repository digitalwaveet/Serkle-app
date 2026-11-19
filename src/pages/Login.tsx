import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Phone } from 'lucide-react';
import { authReturnPath } from '@/lib/authReturnPath';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { resendPendingSignup, savePendingAuth, signInWithPassword } from '@/lib/authFlow';
import { type AuthMethod, authErrorMessage, isUnverifiedAuthError } from '@/lib/authIdentity';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = authReturnPath(location.search);
  const [method, setMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+251');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${returnTo}` },
      });
      if (error) throw error;
    } catch (error) {
      toast({ title: 'Google sign-in failed', description: authErrorMessage(error), variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { data, error, identifier } = await signInWithPassword(
        method,
        method === 'email' ? email : phone,
        password,
        dialCode,
      );

      if (error && isUnverifiedAuthError(error)) {
        const pending = savePendingAuth({ kind: 'signup', method, identifier, returnTo });
        const resendResult = await resendPendingSignup(pending);
        if (resendResult.error) {
          // The verification screen remains useful when a resend is rate-limited.
          console.warn('Verification resend was not completed:', resendResult.error.code);
        }
        navigate(`/verify-account?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
        return;
      }
      if (error) throw error;
      if (!data.session) throw new Error('No secure session was created. Please try again.');

      toast({ title: 'Welcome back', description: 'You are signed in.' });
      navigate(returnTo, { replace: true });
    } catch (error) {
      toast({ title: 'Sign-in failed', description: authErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-tertiary/30 via-background to-secondary/20 p-4 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center overflow-hidden rounded-full border border-border">
            <img src="/lovable-uploads/SerkleMainLogo.svg" alt="Serkle" className="size-7 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
          </div>
        </header>

        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Button type="button" variant="outline" onClick={handleGoogleSignIn} disabled={isLoading} className="h-11 w-full gap-3 rounded-xl text-sm font-medium">
            <span className="flex size-5 items-center justify-center rounded-full font-bold text-[#4285F4]" aria-hidden="true">G</span>
            Sign in with Google
          </Button>

          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">or</span><div className="h-px flex-1 bg-border" /></div>

          <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Sign-in method">
            {(['email', 'phone'] as const).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={method === item} onClick={() => setMethod(item)} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all ${method === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {item === 'email' ? <Mail className="size-4" /> : <Phone className="size-4" />}
                {item === 'email' ? 'Email' : 'Phone'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {method === 'email' ? (
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email address</Label>
                <Input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="login-phone">Phone number</Label>
                <div className="grid grid-cols-[92px_1fr] gap-2">
                  <Input aria-label="Country calling code" inputMode="tel" value={dialCode} onChange={(event) => setDialCode(event.target.value)} />
                  <Input id="login-phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="0911 123 456" value={phone} onChange={(event) => setPhone(event.target.value)} required />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <button type="button" onClick={() => navigate(`/reset-password?method=${method}&returnTo=${encodeURIComponent(returnTo)}`)} className="text-xs font-medium text-primary hover:underline">Forgot password?</button>
              </div>
              <div className="relative">
                <Input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="pr-11" required />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((value) => !value)} className="absolute right-0 top-0 size-10" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-xl text-sm font-medium">
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Don’t have an account?{' '}
          <button type="button" onClick={() => navigate(`/signup?returnTo=${encodeURIComponent(returnTo)}`)} className="font-medium text-primary hover:underline">Sign up</button>
        </p>
      </div>
    </div>
  );
}

