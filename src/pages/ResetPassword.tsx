import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft, KeyRound, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Step = "request" | "enter-otp" | "new-password" | "success";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Check if we arrived via a recovery link (URL hash, query code, or Supabase auth recovery event)
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;

    if (hash.includes("type=recovery") || search.includes("type=recovery")) {
      setStep("new-password");
      setStatusMessage("Verified via recovery link. Please set your new password below.");
    }

    // Listen to Supabase auth state changes for PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("new-password");
        setStatusMessage("Authenticated via recovery link. Please choose a new password.");
      }
    });

    // Also check if current session is in recovery mode or valid
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && (hash.includes("access_token") || hash.includes("type=recovery"))) {
        setStep("new-password");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Step 1: Send reset email / OTP
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Reset link sent!",
        description: `We've sent a password reset link and code to ${email}.`,
      });
      setStep("enter-otp");
      setStatusMessage(`Check your inbox at ${email}. You can either click the link in the email or enter the 6-digit code below.`);
    } catch (err: any) {
      toast({
        title: "Failed to send reset link",
        description: err?.message || "Please check the email address and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      toast({ title: "Invalid code", description: "Please enter the 6-digit code from your email.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanOtp,
        type: "recovery",
      });

      if (error) throw error;

      toast({ title: "Code verified!", description: "Now set your new password." });
      setStep("new-password");
      setStatusMessage(null);
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err?.message || "The code is invalid or has expired.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Save new password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Your new password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setStep("success");
      toast({
        title: "Password reset successful!",
        description: "You can now log in with your new password.",
      });

      // Clear any tokens from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      toast({
        title: "Failed to update password",
        description: err?.message || "An error occurred while setting your new password. Try requesting a new link.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-tertiary/30 via-background to-secondary/20 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        {/* Header with back button */}
        <div className="text-center space-y-4 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/login")}
            className="absolute -top-2 left-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Login
          </Button>

          <div className="flex items-center justify-center w-14 h-14 rounded-full border border-border bg-card mx-auto shadow-sm overflow-hidden">
            <img
              src="/lovable-uploads/SerkleMainLogo.svg"
              alt="Serkle"
              className="h-8 w-8 object-contain"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {step === "request" && "Forgot Password"}
              {step === "enter-otp" && "Enter Reset Code"}
              {step === "new-password" && "Set New Password"}
              {step === "success" && "Password Updated"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === "request" && "Enter your email to receive a recovery link or code"}
              {step === "enter-otp" && `Enter the 6-digit code sent to ${email || "your email"}`}
              {step === "new-password" && "Enter your new secure password below"}
              {step === "success" && "Your password has been changed successfully"}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          {statusMessage && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary leading-relaxed">
              {statusMessage}
            </div>
          )}

          {/* STEP 1: Request reset link */}
          {step === "request" && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="text-xs font-medium text-muted-foreground">
                  Account Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-10 bg-muted/50 border-border focus:border-primary focus:bg-card"
                    required
                    autoFocus
                  />
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full h-11 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
                {isLoading ? (
                  <>
                    <SerkleLoader size="xs" className="text-current mr-2" />
                    Sending link...
                  </>
                ) : (
                  "Send Reset Link & Code"
                )}
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setStep("enter-otp")}
                  className="text-xs text-primary hover:underline"
                >
                  Already have a 6-digit recovery code? Enter code →
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Enter OTP Code */}
          {step === "enter-otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-otp" className="text-xs font-medium text-muted-foreground">
                  6-Digit Recovery Code
                </Label>
                <div className="relative">
                  <Input
                    id="reset-otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="h-12 text-center text-xl tracking-[0.5em] font-mono bg-muted/50 border-border focus:border-primary focus:bg-card"
                    required
                    autoFocus
                  />
                  <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {!email && (
                <div className="space-y-1.5">
                  <Label htmlFor="otp-email" className="text-xs font-medium text-muted-foreground">
                    Email Address
                  </Label>
                  <Input
                    id="otp-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 bg-muted/50 border-border"
                    required
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || otpCode.length < 6}
                className="w-full h-11 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
                {isLoading ? (
                  <>
                    <SerkleLoader size="xs" className="text-current mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>

              <div className="flex justify-between items-center pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStep("request")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ← Request a new code
                </button>
                {email && (
                  <button
                    type="button"
                    onClick={(e) => handleRequestReset(e)}
                    disabled={isLoading}
                    className="text-primary hover:underline"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </form>
          )}

          {/* STEP 3: Set New Password */}
          {step === "new-password" && (
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">
                  New Password (at least 6 characters)
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-11 pr-10 bg-muted/50 border-border focus:border-primary focus:bg-card"
                    required
                    minLength={6}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 pr-10 bg-muted/50 border-border focus:border-primary focus:bg-card"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || newPassword.length < 6 || newPassword !== confirmPassword}
                className="w-full h-11 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
                {isLoading ? (
                  <>
                    <SerkleLoader size="xs" className="text-current mr-2" />
                    Updating password...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          )}

          {/* STEP 4: Success confirmation */}
          {step === "success" && (
            <div className="text-center py-4 space-y-4 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-lg">All Done!</h3>
                <p className="text-sm text-muted-foreground">
                  Your password has been successfully updated. You can now log into your Serkle account.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="w-full h-11 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
                Go to Login
              </Button>
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground text-center">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Secure authentication powered by Serkle</span>
        </div>
      </div>
    </div>
  );
}
