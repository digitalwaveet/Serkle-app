import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authReturnPath } from '@/lib/authReturnPath';
import { Eye, EyeOff, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type InputMode = "email" | "phone";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const navigate = useNavigate();
  const returnTo = authReturnPath(useLocation().search);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${returnTo}`,
        },
      });
      if (error) {
        toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Google sign-in failed", description: err?.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const credentials = inputMode === "email"
        ? { email, password }
        : { phone, password };

      const { data, error } = await supabase.auth.signInWithPassword(credentials);

      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else if (data.session) {
        toast({ title: "Welcome back!", description: "You've successfully logged in." });
        navigate(returnTo, { replace: true });
      }
    } catch {
      toast({ title: "Login failed", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We've sent you a password reset link." });
        setShowForgotPassword(false);
        setResetEmail("");
      }
    } catch {
      toast({ title: "Reset failed", description: "An unexpected error occurred.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-tertiary/30 via-background to-secondary/20 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full border border-border overflow-hidden">
            <img src="/lovable-uploads/SerkleMainLogo.svg" alt="Serkle" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          {/* Google Sign-In */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full h-11 rounded-xl font-medium text-sm gap-3 border-border hover:bg-muted/50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </Button>

          {/* OR Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email/Phone Toggle */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            <button
              type="button"
              onClick={() => setInputMode("email")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => setInputMode("phone")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === "phone"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Phone className="w-4 h-4" />
              Phone
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {inputMode === "email" ? (
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 bg-muted/50 border-border focus:border-primary focus:bg-card"
                  required
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-10 bg-muted/50 border-border focus:border-primary focus:bg-card"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-10 bg-muted/50 border-border focus:border-primary focus:bg-card"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            {inputMode === "email" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-card rounded-xl p-6 w-full max-w-sm animate-scale-in">
              <h3 className="text-lg font-semibold text-foreground mb-2">Reset Password</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="h-10"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setShowForgotPassword(false); setResetEmail(""); }}
                    className="flex-1 h-10 text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 h-10 text-sm bg-primary text-primary-foreground"
                    onClick={handlePasswordReset}
                  >
                    Send Reset Link
                  </Button>
                </div>
                <div className="pt-2 text-center border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      navigate('/reset-password');
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Have a 6-digit code or link? Open Reset Page →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Don't have an account?{" "}
            <button
              onClick={() => navigate('/signup')}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
