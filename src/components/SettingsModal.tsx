import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Lock, Eye, MessageCircle, LogOut, Shield, Mail, Phone, KeyRound, BadgeCheck, ChevronRight, HardDrive, Trash2, Moon, Video, Download, Smartphone, Bell, RefreshCw, Send } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useAutoplaySettings } from '@/hooks/useAutoplaySettings';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsView = 'main' | 'account' | 'notifications';
type PasswordStep = 'idle' | 'sending' | 'code-sent' | 'verifying' | 'new-password' | 'saving';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useUser();
  const navigate = useNavigate();
  const [saving, setSaving] = useState<string | null>(null);
  const [view, setView] = useState<SettingsView>('main');
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { autoplayEnabled, toggleAutoplay } = useAutoplaySettings();
  const { isSupported, permission, requestPermission, unregisterServiceWorker, sendTestNotification } = usePushNotifications();
  const [isPushLoading, setIsPushLoading] = useState(false);

  const handleEnablePush = async () => {
    setIsPushLoading(true);
    await requestPermission();
    setIsPushLoading(false);
  };

  const handleForceEnablePush = async () => {
    setIsPushLoading(true);
    await unregisterServiceWorker();
    // Use URL parameters to signal the app to return here and resubscribe after reload
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'notifications');
    url.searchParams.set('action', 'resubscribe');
    window.location.href = url.toString();
  };

  // Logic to handle auto-opening and auto-resubscribing from URL params
  useEffect(() => {
    if (!isOpen) return;
    
    const params = new URLSearchParams(window.location.search);
    const targetView = params.get('view') as SettingsView;
    const action = params.get('action');
    
    if (targetView === 'notifications') {
      setView('notifications');
      
      if (action === 'resubscribe') {
        // Delay slightly to ensure service worker is initialized
        setTimeout(() => {
          handleEnablePush();
          // Clean up URL parameter so it doesn't re-trigger on subsequent opens
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('action');
          window.history.replaceState({}, document.title, newUrl.toString());
        }, 1000);
      }
    }
  }, [isOpen]);

  // PWA install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const installed = window.matchMedia('(display-mode: standalone)').matches;
    setIsAppInstalled(installed);
    const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iosDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const installedHandler = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        toast({ title: 'App installed!', description: 'Serkle has been added to your home screen.' });
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Install error:', err);
    }
  };

  // Account info state
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);

  // Change password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStep, setPasswordStep] = useState<PasswordStep>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Verify email state
  const [sendingVerification, setSendingVerification] = useState(false);

  // Storage usage state
  const [storageUsage, setStorageUsage] = useState<{ used: number; quota: number } | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  const loadStorageUsage = useCallback(async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setStorageUsage({
          used: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      }
    } catch (e) {
      console.error('Failed to estimate storage:', e);
    }
  }, []);

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      // Clear IndexedDB caches
      const dbs = await indexedDB.databases?.();
      if (dbs) {
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      }
      // Clear Cache Storage
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      toast({ title: 'Cache cleared', description: 'App cache has been cleared successfully.' });
      await loadStorageUsage();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to clear cache.', variant: 'destructive' });
    } finally {
      setClearingCache(false);
    }
  };


  useEffect(() => {
    if (isOpen) {
      loadAccountInfo();
      loadStorageUsage();
    }
  }, [isOpen, loadStorageUsage]);

  const loadAccountInfo = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      setAuthEmail(authUser.email || '');
      setAuthPhone(authUser.phone || '');
      setEmailVerified(!!authUser.email_confirmed_at);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen || !user) return null;

  const handleToggle = async (field: string, value: boolean | string) => {
    setSaving(field);
    try {
      const dbField = field === 'isPrivate' ? 'is_private'
        : field === 'hideFollowers' ? 'hide_followers'
          : field === 'hideOnlineStatus' ? 'hide_online_status'
            : 'allow_messages_from';

      const { error } = await supabase
        .from('profiles')
        .update({ [dbField]: value })
        .eq('id', user.id);

      if (error) throw error;
      await updateProfile({ [field]: value } as any);
    } catch (err) {
      console.error('Failed to update setting:', err);
      toast({
        title: "Update failed",
        description: "Could not save your setting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  // Send password reset OTP to email
  const handleSendPasswordResetCode = async () => {
    if (!authEmail) {
      setPasswordError('No email associated with this account');
      return;
    }
    setPasswordStep('sending');
    setPasswordError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setPasswordStep('code-sent');
      toast({
        title: "Code sent!",
        description: `A password reset link has been sent to ${authEmail}`,
      });
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to send reset code');
      setPasswordStep('idle');
    }
  };

  // Verify OTP code
  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length < 6) {
      setPasswordError('Please enter the 6-digit code');
      return;
    }
    setPasswordStep('verifying');
    setPasswordError('');

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: authEmail,
        token: otpCode.trim(),
        type: 'recovery',
      });

      if (error) throw error;

      setPasswordStep('new-password');
      toast({ title: "Code verified!", description: "Now set your new password." });
    } catch (err: any) {
      setPasswordError(err.message || 'Invalid or expired code');
      setPasswordStep('code-sent');
    }
  };

  // Save new password
  const handleSaveNewPassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setPasswordStep('saving');
    setPasswordError('');

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: "Password updated!", description: "Your password has been changed successfully." });
      resetPasswordModal();
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
      setPasswordStep('new-password');
    }
  };

  const resetPasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordStep('idle');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  // Send email verification (for accounts that already have email)
  const handleResendVerification = async () => {
    setSendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: authEmail,
      });
      if (error) throw error;
      toast({ title: "Verification sent!", description: `Check ${authEmail} for a verification link.` });
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message || "Could not send verification email.",
        variant: "destructive",
      });
    } finally {
      setSendingVerification(false);
    }
  };


  const SettingRow = ({
    icon: Icon,
    label,
    description,
    children
  }: {
    icon: React.ElementType;
    label: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="ml-4 flex-shrink-0">{children}</div>
    </div>
  );

  const maskEmail = (email: string) => {
    if (!email) return 'Not set';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    return `${local[0]}${'•'.repeat(Math.min(local.length - 2, 6))}${local[local.length - 1]}@${domain}`;
  };

  const maskPhone = (phone: string) => {
    if (!phone) return 'Not set';
    if (phone.length <= 4) return phone;
    return `${'•'.repeat(phone.length - 4)}${phone.slice(-4)}`;
  };

  return (
    <>
      <div className="fixed inset-0 bottom-16 z-[60] bg-black/20 backdrop-blur-sm animate-fade-in">
        <div className="h-full w-full bg-background overflow-y-auto scroll-optimized scrollbar-thin overscroll-behavior-contain animate-scale-in">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (view === 'account' || view === 'notifications') setView('main');
                  else onClose();
                }}
                className="hover:bg-muted/50"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-foreground">
                {view === 'main' ? 'Settings' : view === 'account' ? 'Account & Security' : 'Notification Settings'}
              </h1>
              <div className="w-10" />
            </div>
          </div>

          <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
            {view === 'main' && (
              <>
                {/* Appearance */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Appearance</h2>
                  <div className="bg-card rounded-xl border border-border/50 px-4">
                    <SettingRow
                      icon={Moon}
                      label="Dark Mode"
                      description="Switch between dark and light interface"
                    >
                      <Switch
                        checked={isDark}
                        onCheckedChange={toggleDark}
                        id="dark-mode-toggle"
                      />
                    </SettingRow>
                  </div>
                </div>

                {/* Media — Autoplay */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Media</h2>
                  <div className="bg-card rounded-xl border border-border/50 px-4">
                    <SettingRow
                      icon={Video}
                      label="Autoplay Videos"
                      description="Automatically play videos in feeds and Relax"
                    >
                      <Switch
                        checked={autoplayEnabled}
                        onCheckedChange={toggleAutoplay}
                      />
                    </SettingRow>
                  </div>
                </div>

                {/* Notification Settings Entry */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notifications</h2>
                  <div className="bg-card rounded-xl border border-border/50">
                    <button
                      onClick={() => setView('notifications')}
                      className="flex items-center justify-between w-full px-4 py-4 hover:bg-muted/50 transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="h-5 w-5 text-primary" />
                        <div className="text-left">
                          <p className="font-medium text-foreground">Push Notifications</p>
                          <p className="text-sm text-muted-foreground">
                            {permission === 'granted' ? 'Enabled' : 'Setup notifications'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Install App */}
                {!isAppInstalled && (
                  <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Install App</h2>
                    <div className="bg-card rounded-xl border border-border/50 px-4 py-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Smartphone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">Serkle App</p>
                          <p className="text-xs text-muted-foreground">
                            {isIOS
                              ? 'Tap Share → "Add to Home Screen" to install'
                              : 'Install for quick access & offline support'}
                          </p>
                        </div>
                      </div>
                      {!isIOS && (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          onClick={handleInstallApp}
                          disabled={!deferredPrompt}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {deferredPrompt ? 'Install Now' : 'Install via Browser Menu'}
                        </Button>
                      )}
                      {isIOS && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-xs text-muted-foreground">
                          <Download className="h-4 w-4 flex-shrink-0" />
                          <span>Tap the Share button in Safari, then select "Add to Home Screen"</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Privacy & Account — navigates to sub-view */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Privacy & Account</h2>
                  <div className="bg-card rounded-xl border border-border/50">
                    <button
                      onClick={() => setView('account')}
                      className="flex items-center justify-between w-full px-4 py-4 hover:bg-muted/50 transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-primary" />
                        <div className="text-left">
                          <p className="font-medium text-foreground">Account & Security</p>
                          <p className="text-sm text-muted-foreground">Email, phone, password, verification</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Account Privacy */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Account Privacy</h2>
                  <div className="bg-card rounded-xl border border-border/50 px-4">
                    <SettingRow
                      icon={Lock}
                      label="Private Account"
                      description="Only followers can see your posts and videos"
                    >
                      <Switch
                        checked={user.isPrivate}
                        onCheckedChange={(v) => handleToggle('isPrivate', v)}
                        disabled={saving === 'isPrivate'}
                      />
                    </SettingRow>
                  </div>
                </div>

                {/* Profile Visibility */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Profile Visibility</h2>
                  <div className="bg-card rounded-xl border border-border/50 px-4 divide-y divide-border/50">
                    <SettingRow
                      icon={Eye}
                      label="Hide Followers Count"
                      description="Others won't see your followers/following counts"
                    >
                      <Switch
                        checked={user.hideFollowers}
                        onCheckedChange={(v) => handleToggle('hideFollowers', v)}
                        disabled={saving === 'hideFollowers'}
                      />
                    </SettingRow>
                    <SettingRow
                      icon={Shield}
                      label="Hide Online Status"
                      description="Others won't see when you're online"
                    >
                      <Switch
                        checked={user.hideOnlineStatus}
                        onCheckedChange={(v) => handleToggle('hideOnlineStatus', v)}
                        disabled={saving === 'hideOnlineStatus'}
                      />
                    </SettingRow>
                  </div>
                </div>

                {/* Messaging */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Messaging</h2>
                  <div className="bg-card rounded-xl border border-border/50 px-4">
                    <SettingRow
                      icon={MessageCircle}
                      label="Allow Messages From"
                      description="Control who can send you messages"
                    >
                      <Select
                        value={user.allowMessagesFrom}
                        onValueChange={(v) => handleToggle('allowMessagesFrom', v)}
                        disabled={saving === 'allowMessagesFrom'}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone">Everyone</SelectItem>
                          <SelectItem value="followers">Followers</SelectItem>
                          <SelectItem value="nobody">Nobody</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingRow>
                  </div>
                </div>

                {/* Storage Usage */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Storage</h2>
                  <div className="bg-card rounded-xl border border-border/50 px-4 py-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-foreground text-sm">App Storage</p>
                          <p className="text-xs text-muted-foreground">
                            {storageUsage
                              ? `${formatBytes(storageUsage.used)} / ${formatBytes(storageUsage.quota)}`
                              : 'Calculating…'}
                          </p>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{
                              width: storageUsage
                                ? `${Math.min((storageUsage.used / storageUsage.quota) * 100, 100)}%`
                                : '0%',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleClearCache}
                      disabled={clearingCache}
                    >
                      {clearingCache ? (
                        <SerkleLoader size="xs" className="text-current mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Clear Cache
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Logout */}
                <Button
                  variant="destructive"
                  className="w-full h-12"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  Log Out
                </Button>
              </>
            )}

            {view === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border/50 p-6 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Bell className={`h-8 w-8 ${permission === 'granted' ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Push Notifications</h3>
                    <p className="text-sm text-muted-foreground">
                      {!isSupported 
                        ? 'Not supported on this browser/device' 
                        : permission === 'granted' 
                          ? 'You are all set to receive notifications' 
                          : 'Stay updated with messages and alerts'}
                    </p>
                  </div>

                  <div className="pt-2">
                    {permission !== 'granted' && isSupported && (
                      <Button 
                        onClick={handleEnablePush} 
                        disabled={isPushLoading || permission === 'denied'}
                        className="w-full h-12 text-base"
                      >
                        {isPushLoading ? <SerkleLoader size="xs" className="text-current mr-2" /> : <Bell className="h-5 w-5 mr-2" />}
                        Enable Notifications
                      </Button>
                    )}
                    
                    {permission === 'granted' && (
                      <Button
                        variant="secondary"
                        onClick={sendTestNotification}
                        disabled={isPushLoading}
                        className="w-full h-12 text-base"
                      >
                        <Send className="h-5 w-5 mr-2" />
                        Send Test Notification
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Troubleshooting</h3>
                  
                  <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/50">
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-primary" />
                        <p className="font-medium">Force Enable</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Enabled but not getting alerts? This will reset the connection and re-register your device.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleForceEnablePush}
                        disabled={isPushLoading}
                        className="mt-2"
                      >
                        {isPushLoading ? <SerkleLoader size="xs" className="text-current mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Force Re-enable
                      </Button>
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <p className="font-medium">Browser Permissions</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Current permission: <span className="font-mono font-bold capitalize">{permission}</span>
                      </p>
                      {permission === 'denied' && (
                        <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                          Notifications are blocked at the browser level. Please open your browser settings to allow Serkle to send notifications.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'account' && (
              <>
                {/* Account Information */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Account Information</h2>
                  <div className="bg-card rounded-xl border border-border/50 px-4 divide-y divide-border/50">
                    {/* Email */}
                    <div className="flex items-center justify-between py-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Mail className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">Email</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {authEmail ? maskEmail(authEmail) : 'Not set'}
                          </p>
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        {!authEmail ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/email-address')}
                            className="text-xs"
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Enter Email
                          </Button>
                        ) : emailVerified ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-primary">
                            <BadgeCheck className="h-4 w-4" />
                            Verified
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResendVerification}
                            disabled={sendingVerification}
                            className="text-xs"
                          >
                            {sendingVerification ? (
                              <SerkleLoader size="xs" className="text-current mr-1" />
                            ) : null}
                            Verify
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center justify-between py-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Phone className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">Phone</p>
                          <p className="text-sm text-muted-foreground">{maskPhone(authPhone)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Security</h2>
                  <div className="bg-card rounded-xl border border-border/50">
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="flex items-center justify-between w-full px-4 py-4 hover:bg-muted/50 transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <KeyRound className="h-5 w-5 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium text-foreground">Change Password</p>
                          <p className="text-sm text-muted-foreground">We'll send a code to your email</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={(v) => { if (!v) resetPasswordModal(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              {passwordStep === 'idle' || passwordStep === 'sending'
                ? `We'll send a verification code to ${maskEmail(authEmail)}`
                : passwordStep === 'code-sent' || passwordStep === 'verifying'
                  ? 'Enter the 6-digit code from your email'
                  : 'Set your new password'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Step 1: Send code */}
            {(passwordStep === 'idle' || passwordStep === 'sending') && (
              <Button
                onClick={handleSendPasswordResetCode}
                disabled={passwordStep === 'sending'}
                className="w-full"
              >
                {passwordStep === 'sending' ? (
                  <SerkleLoader size="xs" className="text-current mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                {passwordStep === 'sending' ? 'Sending...' : 'Send Verification Code'}
              </Button>
            )}

            {/* Step 2: Enter OTP */}
            {(passwordStep === 'code-sent' || passwordStep === 'verifying') && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="otp-code">Verification Code</Label>
                  <Input
                    id="otp-code"
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value); setPasswordError(''); }}
                    maxLength={6}
                    className={`text-center text-lg tracking-widest font-mono ${passwordError ? 'border-destructive' : ''}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
                  />
                </div>
                <Button
                  onClick={handleVerifyOtp}
                  disabled={passwordStep === 'verifying' || otpCode.length < 6}
                  className="w-full"
                >
                  {passwordStep === 'verifying' && <SerkleLoader size="xs" className="text-current mr-2" />}
                  {passwordStep === 'verifying' ? 'Verifying...' : 'Verify Code'}
                </Button>
                <button
                  onClick={handleSendPasswordResetCode}
                  className="text-sm text-primary hover:underline w-full text-center"
                >
                  Resend code
                </button>
              </div>
            )}

            {/* Step 3: New password */}
            {(passwordStep === 'new-password' || passwordStep === 'saving') && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-pw">New Password</Label>
                  <Input
                    id="new-pw"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pw">Confirm Password</Label>
                  <Input
                    id="confirm-pw"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNewPassword(); }}
                  />
                </div>
                <Button
                  onClick={handleSaveNewPassword}
                  disabled={passwordStep === 'saving'}
                  className="w-full"
                >
                  {passwordStep === 'saving' && <SerkleLoader size="xs" className="text-current mr-2" />}
                  {passwordStep === 'saving' ? 'Saving...' : 'Update Password'}
                </Button>
              </div>
            )}

            {passwordError && (
              <p className="text-sm text-destructive text-center">{passwordError}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default SettingsModal;