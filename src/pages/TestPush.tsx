import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Send, Shield, Info, RefreshCw, Trash2, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TestPush = () => {
  const navigate = useNavigate();
  const { isSupported, permission, subscription, requestPermission, unregisterServiceWorker } = usePushNotifications();
  const [isSending, setIsSending] = useState(false);
  const [showRawSub, setShowRawSub] = useState(false);

  const handleTestNotification = async () => {
    if (!subscription) {
      toast.error('You must be subscribed to test notifications');
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      console.log('Triggering test notification for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title: '🔔 Test Notification',
          body: 'This is a test notification from the Serkle debug page!',
          data: { test: true, timestamp: new Date().toISOString() }
        }
      });

      if (error) throw error;
      
      toast.success('Test notification triggered!');
      console.log('Edge function response:', data);
    } catch (error) {
      console.error('Error triggering push:', error);
      toast.error('Failed to trigger test notification');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Push Notification Debug</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Environment Status
            </CardTitle>
            <CardDescription>
              Check if your browser supports Web Push and what the current permission status is.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Browser Support</span>
              <span className={`text-xs px-2 py-1 rounded-full ${isSupported ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isSupported ? 'Supported' : 'Not Supported'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Notification Permission</span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                permission === 'granted' ? 'bg-green-100 text-green-700' : 
                permission === 'denied' ? 'bg-red-100 text-red-700' : 
                'bg-yellow-100 text-yellow-700'
              }`}>
                {permission.charAt(0).toUpperCase() + permission.slice(1)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Subscription Status</span>
              <span className={`text-xs px-2 py-1 rounded-full ${subscription ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {subscription ? 'Subscribed' : 'Not Subscribed'}
              </span>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={requestPermission} 
              disabled={!isSupported || permission === 'granted'}
              className="w-full"
            >
              <Bell className="mr-2 h-4 w-4" />
              {permission === 'granted' ? 'Permission Granted' : 'Request Permission & Subscribe'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Test Delivery
            </CardTitle>
            <CardDescription>
              Trigger a test notification from the backend to this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="bg-muted p-4 rounded-lg overflow-hidden">
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {JSON.stringify(subscription.toJSON(), null, 2)}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 text-yellow-700 bg-yellow-50 rounded-lg text-sm">
                <Info className="h-4 w-4" />
                Please subscribe first to enable testing.
              </div>
            )}
          </CardContent>
          <CardFooter>
            {!subscription ? (
              <Button 
                onClick={requestPermission} 
                className="w-full"
                variant="default"
              >
                <Bell className="mr-2 h-4 w-4" />
                Subscribe Now
              </Button>
            ) : (
              <Button 
                onClick={handleTestNotification} 
                disabled={isSending}
                className="w-full"
                variant="secondary"
              >
                {isSending ? (
                  <>
                    <SerkleLoader size="xs" className="text-current mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Trigger Test Notification
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Troubleshooting / Reset
            </CardTitle>
            <CardDescription>
              If push registration keeps failing with "Push Service Error", try resetting the service worker.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Resetting will unregister all service workers and clear the current subscription. You will need to reload the page and subscribe again.
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-white"
              onClick={unregisterServiceWorker}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Reset Service Worker
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>
          </CardFooter>
        </Card>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-1 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Testing Instructions
          </h4>
          <ul className="text-xs text-blue-800 space-y-1 list-disc ml-4">
            <li>Ensure you have granted notification permissions in your browser settings.</li>
            <li>If you get <strong>"AbortError: Registration failed - push service error"</strong>, it usually indicates the browser can't reach the push service or the VAPID key is invalid.</li>
            <li>Check the <strong>Browser Console</strong> (F12) for detailed logs including VAPID key byte length.</li>
            <li>Ensure you are not in Incognito/Private mode, as push is often disabled there.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestPush;
