import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export const NotificationPermissionPrompt = () => {
  const [show, setShow] = useState(false);
  const { isSupported, permission, requestPermission } = usePushNotifications();

  useEffect(() => {
    // Show prompt if notifications are supported and not yet decided
    if (isSupported && permission === 'default') {
      const hasSeenPrompt = localStorage.getItem('notification-prompt-seen');
      if (!hasSeenPrompt) {
        setTimeout(() => setShow(true), 3000); // Show after 3 seconds
      }
    }
  }, [isSupported, permission]);

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      localStorage.setItem('notification-prompt-seen', 'true');
      setShow(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notification-prompt-seen', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <Card className="p-4 max-w-sm shadow-lg border-primary/20">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-sm">Enable Notifications</h3>
            <p className="text-xs text-muted-foreground">
              Get instant alerts for emergencies, helper responses, and important updates
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEnable} className="flex-1">
                Enable
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
