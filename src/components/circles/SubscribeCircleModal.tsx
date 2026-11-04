import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Check, Coins, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { purchaseCircleAccess, CIRCLE_ACCESS_QUERY_KEYS } from '@/lib/circlePayments';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';

interface SubscribeCircleModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  circleName: string;
  subscriptionPrice?: number;
  onSubscribed: () => void | Promise<void>;
  renewExpiresAt?: string;
}

const FALLBACK_COST = 10;

export const SubscribeCircleModal: React.FC<SubscribeCircleModalProps> = ({
  isOpen,
  onClose,
  circleId,
  circleName,
  subscriptionPrice,
  onSubscribed,
  renewExpiresAt,
}) => {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { toast } = useToast();
  const submitting = useRef(false);
  const queryClient = useQueryClient();
  const { user } = useUser();
  const SUBSCRIPTION_COST = subscriptionPrice ?? FALLBACK_COST;
  const { balance } = useCoinWallet(user?.id);
  const hasEnoughCoins = balance >= SUBSCRIPTION_COST;

  const handleSubscribe = async () => {
    if (submitting.current) return;
    if (!hasEnoughCoins) {
      toast({ title: 'Insufficient coins', description: `You need ${SUBSCRIPTION_COST} coins to subscribe.`, variant: 'destructive' });
      return;
    }

    submitting.current = true;
    setIsSubscribing(true);
    try {
      const result = await purchaseCircleAccess('subscription', circleId, { expectedPrice: SUBSCRIPTION_COST, renew: !!renewExpiresAt, expectedExpiresAt: renewExpiresAt });
      await Promise.all(CIRCLE_ACCESS_QUERY_KEYS.map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      toast({ title: renewExpiresAt ? 'Subscription renewed' : 'Subscribed successfully', description: result.charged ? `${result.charged} coins paid. Premium posts, videos and resources are included.` : 'Your existing subscription already includes this content.' });
      await onSubscribed();
      onClose();
    } catch (error: any) {
      console.error('Error subscribing:', error);
      toast({ title: "Subscription failed", description: error.message, variant: "destructive" });
    } finally {
      submitting.current = false;
      setIsSubscribing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            {renewExpiresAt ? 'Renew' : 'Subscribe to'} {circleName}
          </DialogTitle>
          <DialogDescription>
            Includes premium posts, videos and resources for one calendar month. Events and services are sold separately.
          </DialogDescription>
        </DialogHeader>
        {renewExpiresAt && <p className="text-sm text-muted-foreground">This payment adds one calendar month after {new Date(renewExpiresAt).toLocaleString()}.</p>}

        <div className="space-y-6 py-4">
          {/* Benefits */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">What you'll get:</h4>
            <ul className="space-y-2">
              {[
                'All premium posts, videos and resources',
                'Exclusive content from the Circle creator',
                'Cancel at any time; access lasts through your paid period',
                'Support the Circle and its creator',
              ].map((benefit, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Cost */}
          <div className="bg-accent/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Subscription cost</span>
              <div className="flex items-center gap-1">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className="font-bold">{SUBSCRIPTION_COST} coins</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Your balance</span>
              <span>{balance.toLocaleString()} coins</span>
            </div>
          </div>

          {!hasEnoughCoins && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              Insufficient coins. Top up your wallet first.
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSubscribing}>
              Cancel
            </Button>
            <Button onClick={handleSubscribe} disabled={isSubscribing || !hasEnoughCoins} className="gap-2">
              <Coins className="w-4 h-4" />
              {isSubscribing ? 'Processing...' : `${renewExpiresAt ? 'Renew' : 'Subscribe'} (${SUBSCRIPTION_COST} coins)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
