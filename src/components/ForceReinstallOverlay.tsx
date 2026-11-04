import React, { useEffect, useState } from 'react';
import { Smartphone, Trash2, DownloadCloud, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const ForceReinstallOverlay = () => {
  const [isOldPwa, setIsOldPwa] = useState(false);

  useEffect(() => {
    // Method 1: Check if running in standalone mode (PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone);
    
    // Method 2: Check if the URL has the new ?app=serkle parameter from the updated manifest start_url
    const searchParams = new URLSearchParams(window.location.search);
    const hasNewStartUrl = searchParams.get('app') === 'serkle';

    // Method 3: Check local storage override flag
    const hasOverride = localStorage.getItem('serkle_v2_installed') === 'true';
    
    // If they are visiting in the normal browser (not standalone), or they used the new start_url, 
    // we save the override flag. On Android, installing the PWA from Chrome copies localStorage to the WebAPK!
    if (!isStandalone || hasNewStartUrl) {
      localStorage.setItem('serkle_v2_installed', 'true');
    }

    // Only block if it is standalone, NO new start url, AND NO override flag.
    if (isStandalone && !hasNewStartUrl && !hasOverride) {
      setIsOldPwa(true);
    }
  }, []);

  const handleBypass = () => {
    // Escape hatch in case the browser is stubbornly caching the old start_url after a reinstall
    localStorage.setItem('serkle_v2_installed', 'true');
    setIsOldPwa(false);
  };

  if (!isOldPwa) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <Smartphone size={40} />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Action Required</h1>
          <p className="text-muted-foreground text-base">
            We've fully rebranded to <strong>Serkle</strong>! To get the new app icon and name on your home screen, you must reinstall the app.
          </p>
        </div>

        <div className="bg-card border rounded-2xl p-5 text-left space-y-4 shadow-sm">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Trash2 className="text-destructive size-4" /> 
            Step 1: Uninstall
          </h3>
          <p className="text-muted-foreground text-sm pl-6">
            Delete this app from your home screen (long press the app icon and select Remove/Uninstall).
          </p>
          
          <div className="h-px bg-border w-full my-3"></div>
          
          <h3 className="font-semibold text-base flex items-center gap-2">
            <DownloadCloud className="text-primary size-4" /> 
            Step 2: Reinstall
          </h3>
          <p className="text-muted-foreground text-sm pl-6">
            Open your browser (Chrome or Safari), visit our site again, and tap "Add to Home Screen".
          </p>
        </div>
        
        <div className="pt-4 flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground max-w-[280px]">
            This screen will disappear automatically once you've reinstalled the new Serkle app.
          </p>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBypass}
            className="text-xs text-muted-foreground/60 hover:text-foreground mt-4"
          >
            <CheckCircle2 className="mr-2 h-3 w-3" />
            I have already reinstalled it
          </Button>
        </div>
      </div>
    </div>
  );
};
