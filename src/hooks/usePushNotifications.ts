import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Must match the VAPID_PUBLIC_KEY secret configured for the edge functions.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    // Check if browser supports notifications
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    if (supported) {
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
      // Re-save on every launch: heals server-side drift after the browser
      // rotates the subscription (pushsubscriptionchange) while the app was
      // closed, so background delivery keeps working over time.
      if (sub) {
        saveSubscription(sub);
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  // Clear the installed-app icon badge once the user is back in the app
  useEffect(() => {
    const clearBadge = () => {
      try {
        (navigator as any).clearAppBadge?.();
      } catch { /* Badging API not supported */ }
    };
    clearBadge();
    const onVisible = () => {
      if (document.visibilityState === 'visible') clearBadge();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const unregisterServiceWorker = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      setSubscription(null);
      toast.success('Service worker unregistered. Please reload.');
    } catch (error) {
      console.error('Error unregistering service worker:', error);
      toast.error('Failed to unregister service worker');
    }
  };

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error('Push notifications not supported in this browser');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        const subscribed = await subscribeToPush();
        if (subscribed) {
          toast.success('Notifications enabled!');
          return true;
        } else {
          toast.error('Failed to subscribe to push notifications');
          return false;
        }
      } else {
        toast.error('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Error enabling notifications');
      return false;
    }
  };

  const subscribeToPush = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const registration = await navigator.serviceWorker.ready;
      console.log('Service worker ready for push subscription');

      // Uniquely solving AbortError by ensuring active state and adding a tiny initialization delay
      if (!registration.active) {
        console.log('Service worker is not active yet. Waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        // Even if active, Chromium push service sometimes races. 500ms delay helps immensely.
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Check existing subscription
      let sub = await registration.pushManager.getSubscription();

      if (sub) {
        console.log('Existing push subscription found, reusing it');
      } else {
        if (!VAPID_PUBLIC_KEY) {
          toast.error('Push is not configured (missing VITE_VAPID_PUBLIC_KEY).');
          return false;
        }
        console.log('Creating new push subscription with VAPID key');
        let applicationServerKey;
        try {
          applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        } catch (e) {
          console.error('Failed to parse VAPID key:', e);
          toast.error('Push configuration error (VAPID key invalid).');
          return false;
        }

        console.log('VAPID key byte length:', applicationServerKey.length);
        try {
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey,
          });
          console.log('Push subscription created successfully');
        } catch (subErr: any) {
          console.error('Push Service Subscription Failed:', subErr.name, subErr.message, subErr);
          if (subErr.name === 'NotAllowedError') {
             toast.error('Notifications blocked by browser settings.');
          } else if (subErr.name === 'AbortError') {
             toast.error('Push service error. Check browser (Brave?), adblockers, or GCM ID.');
          } else {
             toast.error(`Subscription failed: ${subErr.message}`);
          }
          return false;
        }
      }

      setSubscription(sub);
      // Save to backend
      await saveSubscription(sub);
      return true;
    } catch (error: any) {
      console.error('Error subscribing to push:', error);
      return false;
    }
  };

  const saveSubscription = async (sub: PushSubscription) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found, cannot save push subscription');
        return;
      }

      const subJson = sub.toJSON();
      
      // Get project ID from standard Supabase URL if not in env
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const projectId = supabaseUrl.split('.')[0].split('//')[1] || import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/save-push-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subscription: {
              endpoint: subJson.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh,
                auth: subJson.keys?.auth,
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        console.error('Failed to save push subscription:', err);
      } else {
        console.log('Push subscription saved to backend');
      }
    } catch (error) {
      console.error('Error saving push subscription:', error);
    }
  };

  const sendTestNotification = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return false;
      }

      // Self-heal: permission can be granted while this browser has no push
      // subscription yet (fresh profile, cleared site data, new device).
      // Permission is already granted when this button is visible, so
      // subscribing here shows no prompt.
      if (!subscription) {
        toast.info('Setting up this device for push...');
        const ok = await subscribeToPush();
        if (!ok) {
          toast.error('Could not subscribe this browser — try "Force Enable" below');
          return false;
        }
      }

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title: '🔔 Test Notification',
          body: 'This is a test notification from your Serkle settings!',
          data: { test: true, timestamp: new Date().toISOString() }
        }
      });

      if (error) throw error;

      // Report what the server actually did instead of a blind success:
      // the queued shape comes from the DB-trigger pipeline; webPushResults
      // from direct delivery.
      const results: string[] = data?.webPushResults ?? [];
      const delivered = results.filter((r: string) => r.startsWith('Push sent')).length;

      if (data?.queued) {
        toast.success('Test notification queued — it should arrive in a moment');
      } else if (delivered > 0) {
        toast.success('Test notification sent to this device!');
      } else if (results.length > 0) {
        toast.error(`Push failed: ${results[0]}`);
        console.error('Web push results:', results);
      } else {
        toast.error('Server delivered nothing — no saved subscription for this account, or VAPID keys are missing in Supabase secrets');
      }
      return true;
    } catch (error) {
      console.error('Error triggering push:', error);
      toast.error('Failed to trigger test notification');
      return false;
    }
  };

  return {
    permission,
    isSupported,
    subscription,
    requestPermission,
    unregisterServiceWorker,
    sendTestNotification,
  };
};
