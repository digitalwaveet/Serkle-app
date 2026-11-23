import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { authReturnPath } from '@/lib/authReturnPath';
import { beginSignup, hasUsableSession, savePendingAuth } from '@/lib/authFlow';
import { authErrorMessage, isValidEmail } from '@/lib/authIdentity';
import {
  PROFILE_GENDER_OPTIONS,
  savePendingSignupGender,
  type ProfileGender,
} from '@/lib/profileAvatar';

export default function Signup() {
  const navigate = useNavigate();
  const returnTo = authReturnPath(useLocation().search);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gender, setGender] = useState<ProfileGender | ''>('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const loginPath = `/login?returnTo=${encodeURIComponent(returnTo)}`;

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    if (!gender) {
      toast({ title: 'Profile illustration required', description: 'Choose the profile illustration you want to start with.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      savePendingSignupGender(gender);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${returnTo}` },
      });
      if (error) throw error;
    } catch (error) {
      toast({ title: 'Google sign-up failed', description: authErrorMessage(error), variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    if (!formData.fullName.trim()) {
      toast({ title: 'Name required', description: 'Enter your full name.', variant: 'destructive' });
      return;
    }
    if (!gender) {
      toast({ title: 'Profile illustration required', description: 'Choose the profile illustration you want to start with.', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(formData.email)) {
      toast({ title: 'Invalid email', description: 'Enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (formData.password.length < 8) {
      toast({ title: 'Password too short', description: 'Use at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Passwords don't match", description: 'Enter the same password twice.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error, identifier } = await beginSignup({
        method: 'email',
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        gender,
        returnTo,
      });
      if (error) throw error;
      if (hasUsableSession(data.session)) {
        navigate(returnTo, { replace: true });
        return;
      }
      savePendingAuth({ kind: 'signup', method: 'email', identifier, returnTo });
      navigate(`/verify-account?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    } catch (error) {
      toast({ title: 'Could not create account', description: authErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-tertiary/30 via-background to-secondary/20 p-4 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        <header className="relative space-y-4 text-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(loginPath)} className="absolute left-0 top-0" aria-label="Back to sign in">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="mx-auto flex size-12 items-center justify-center overflow-hidden rounded-full border border-border">
            <img src="/lovable-uploads/SerkleMainLogo.svg" alt="Serkle" className="size-7 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Join Serkle</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create and verify your account</p>
          </div>
        </header>

        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Choose your starting profile</legend>
            <p className="text-xs text-muted-foreground">You can replace this illustration with your own photo at any time.</p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {PROFILE_GENDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={gender === option.value}
                  onClick={() => setGender(option.value)}
                  className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${gender === option.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-background hover:border-primary/40'}`}
                >
                  <img src={`/illustrations/profile-${option.value}.svg`} alt="" className="size-12 rounded-full object-cover" />
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Button type="button" variant="outline" onClick={handleGoogleSignIn} disabled={isLoading} className="h-11 w-full gap-3 rounded-xl text-sm font-medium">
            <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign up with Google
          </Button>

          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">or</span><div className="h-px flex-1 bg-border" /></div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Full name</Label>
              <Input id="full-name" autoComplete="name" value={formData.fullName} onChange={(event) => updateField('fullName', event.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email">Email address</Label>
              <Input id="signup-email" type="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={(event) => updateField('email', event.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={formData.password} onChange={(event) => updateField('password', event.target.value)} className="pr-11" required />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((value) => !value)} className="absolute right-0 top-0 size-10" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={formData.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} className="pr-11" required />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-0 top-0 size-10" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}>
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-xl text-sm font-medium">
              {isLoading ? 'Creating account…' : 'Create account with email'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <button type="button" onClick={() => navigate(loginPath)} className="font-medium text-primary hover:underline">Sign in</button>
        </p>
      </div>
    </div>
  );
}
