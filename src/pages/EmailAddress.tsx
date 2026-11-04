import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';

type EmailStep = 'enter' | 'sending' | 'otp-sent' | 'verifying' | 'verified';

const STORAGE_KEY = 'email_verify_flow';

const EmailAddress: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  // Restore persisted state from sessionStorage
  const persisted = (() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as { email: string; step: EmailStep };
    } catch {}
    return null;
  })();

  const [email, setEmail] = useState(persisted?.email || '');
  const [step, setStep] = useState<EmailStep>(
    persisted?.step === 'otp-sent' || persisted?.step === 'verifying' ? 'otp-sent' : 'enter'
  );
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);

  // Load current auth email status
  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setAuthEmail(authUser.email || '');
        setEmailVerified(!!authUser.email_confirmed_at);
      }
    })();
  }, []);

  // Persist step + email to sessionStorage so it survives reload
  useEffect(() => {
    if (step === 'otp-sent' || step === 'verifying') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email, step: 'otp-sent' }));
    } else if (step === 'verified' || step === 'enter') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [step, email]);

  const handleSendOtp = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    setStep('sending');
    setError('');
    try {
      const { error: err } = await supabase.auth.updateUser({ email: email.trim() });
      if (err) throw err;
      setStep('otp-sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
      setStep('enter');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length < 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setStep('verifying');
    setError('');
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email_change',
      });
      if (err) throw err;
      sessionStorage.removeItem(STORAGE_KEY);
      setStep('verified');
      toast({ title: "Email verified!", description: "Your email has been added and verified." });
      // Navigate back after a short delay
      setTimeout(() => navigate(-1), 1500);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code');
      setStep('otp-sent');
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    navigate(-1);
  };

  // If user already has a verified email, show that
  if (authEmail && emailVerified) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Email Address</h1>
            <div className="w-10" />
          </div>
        </div>
        <div className="px-4 py-8 max-w-md mx-auto text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <BadgeCheck className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Email Verified</h2>
          <p className="text-sm text-muted-foreground">{authEmail}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">
            {step === 'verified' ? 'Email Verified' : step === 'otp-sent' || step === 'verifying' ? 'Verify Email' : 'Add Email'}
          </h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 py-8 max-w-md mx-auto space-y-6">
        {/* Step 1: Enter email */}
        {(step === 'enter' || step === 'sending') && (
          <>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Enter your email address</h2>
              <p className="text-sm text-muted-foreground">
                We'll send a verification code to confirm it's yours
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email-input">Email Address</Label>
                <Input
                  id="email-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(); }}
                  autoFocus
                />
              </div>
              <Button
                onClick={handleSendOtp}
                disabled={step === 'sending' || !email.trim()}
                className="w-full h-12"
              >
                {step === 'sending' ? (
                  <SerkleLoader size="xs" className="text-current mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                {step === 'sending' ? 'Sending...' : 'Send Verification Code'}
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Enter OTP */}
        {(step === 'otp-sent' || step === 'verifying') && (
          <>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="otp-input">Verification Code</Label>
                <Input
                  id="otp-input"
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  onChange={(e) => { setOtpCode(e.target.value); setError(''); }}
                  maxLength={6}
                  className="text-center text-lg tracking-widest font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
                  autoFocus
                />
              </div>
              <Button
                onClick={handleVerifyOtp}
                disabled={step === 'verifying' || otpCode.length < 6}
                className="w-full h-12"
              >
                {step === 'verifying' && <SerkleLoader size="xs" className="text-current mr-2" />}
                {step === 'verifying' ? 'Verifying...' : 'Verify Email'}
              </Button>
              <button
                onClick={handleSendOtp}
                className="text-sm text-primary hover:underline w-full text-center"
              >
                Resend code
              </button>
            </div>
          </>
        )}

        {/* Step 3: Success */}
        {step === 'verified' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <BadgeCheck className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Email Verified!</h2>
            <p className="text-sm text-muted-foreground">
              {email} has been linked to your account
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>
    </div>
  );
};

export default EmailAddress;
