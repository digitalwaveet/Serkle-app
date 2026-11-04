import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'installPromptDismissedAt';
const DISMISS_DURATION_HOURS = 24; // Show again after 24 hours

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if on iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const hoursSinceDismiss = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      if (hoursSinceDismiss < DISMISS_DURATION_HOURS) {
        return; // Still within dismiss period
      }
      // Clear old dismissal
      localStorage.removeItem(DISMISS_KEY);
    }

    // For iOS, show the prompt after a short delay (no beforeinstallprompt event on iOS)
    if (isIOSDevice) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      // Show prompt after a short delay for better UX
      setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // Can't programmatically install on iOS, just keep showing instructions
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store dismissal time for 24-hour cooldown
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  // Don't show if already installed or prompt not ready
  if (isInstalled || !showPrompt) {
    return null;
  }

  // For non-iOS, also check if we have the deferred prompt
  if (!isIOS && !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 mx-4 max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-background border border-border rounded-2xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
            <Smartphone className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Install Serkle App
            </h3>
            {isIOS ? (
              <p className="text-xs text-muted-foreground mt-1">
                Tap <span className="inline-flex items-center"><Download className="w-3 h-3 mx-0.5" /></span> Share then "Add to Home Screen" for the best experience
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Get quick access from your home screen with offline support
              </p>
            )}
            <div className="flex gap-2 mt-3">
              {!isIOS && (
                <Button
                  size="sm"
                  onClick={handleInstallClick}
                  className="text-xs h-8 bg-primary hover:bg-primary/90"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Install Now
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-xs h-8"
              >
                {isIOS ? "Got it" : "Maybe later"}
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
