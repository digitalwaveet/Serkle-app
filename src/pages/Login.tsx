import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { authReturnPath } from '@/lib/authReturnPath';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { resendPendingSignup, savePendingAuth, signInWithPassword } from '@/lib/authFlow';
import { authErrorMessage, authMethodForIdentifier, isUnverifiedAuthError } from '@/lib/authIdentity';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = authReturnPath(location.search);
  const [identifierValue, setIdentifierValue] = useState('');
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
      const method = authMethodForIdentifier(identifierValue);
      const { data, error, identifier } = await signInWithPassword(
        method,
        identifierValue,
        password,
      );

      if (error && isUnverifiedAuthError(error)) {
        if (method === 'phone') {
          throw new Error('Phone verification is temporarily unavailable. Existing verified phone accounts can still sign in.');
        }
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-identifier">Email or phone number</Label>
              <Input
                id="login-identifier"
                type="text"
                autoComplete="username"
                placeholder="you@example.com or 0911 123 456"
                value={identifierValue}
                onChange={(event) => setIdentifierValue(event.target.value)}
                aria-describedby="login-identifier-help"
                required
              />
              <p id="login-identifier-help" className="text-xs text-muted-foreground">
                Existing phone accounts can continue signing in with their number.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <button type="button" onClick={() => navigate(`/reset-password?returnTo=${encodeURIComponent(returnTo)}`)} className="text-xs font-medium text-primary hover:underline">Forgot password?</button>
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

