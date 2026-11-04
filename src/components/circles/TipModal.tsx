import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Coins, Gift, AlertCircle } from 'lucide-react';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTip: (amount: number) => void;
  authorName: string;
  postId: string;
}

const PRESET_AMOUNTS = [1, 3, 5, 10];

export const TipModal: React.FC<TipModalProps> = ({
  isOpen,
  onClose,
  onTip,
  authorName,
  postId
}) => {
  const { user } = useUser();
  const { balance, transferCoins } = useCoinWallet(user?.id);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const finalAmount = selectedAmount || parseInt(customAmount) || 0;
  const isValidAmount = finalAmount > 0 && finalAmount <= 1000;
  const hasEnoughCoins = finalAmount <= balance;

  const handleTip = async () => {
    if (!isValidAmount || !hasEnoughCoins || !user?.id) return;
    
    setIsProcessing(true);
    
    try {
      // Get post author ID
      const { data: post } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (!post) throw new Error('Post not found');

      await transferCoins.mutateAsync({
        receiverId: post.user_id,
        amount: finalAmount,
        typeSent: 'tip_sent',
        typeReceived: 'tip_received',
        referenceId: postId,
        description: `Tip to ${authorName}`,
      });

      setShowSuccess(true);
      setTimeout(() => {
        onTip(finalAmount);
        setShowSuccess(false);
        setSelectedAmount(null);
        setCustomAmount('');
      }, 2000);
    } catch (error) {
      console.error('Tip failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setSelectedAmount(null);
    setCustomAmount('');
    setIsProcessing(false);
    setShowSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8 text-green-600 dark:text-green-400 fill-current" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                <Coins className="w-4 h-4 text-yellow-900" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Tip Sent! 🎉</h3>
              <p className="text-sm text-muted-foreground">
                {finalAmount} coins sent to {authorName}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Tip {authorName}
          </DialogTitle>
          <DialogDescription>
            Show your appreciation with coins
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Balance display */}
          <div className="flex items-center gap-2 bg-accent/50 rounded-lg px-3 py-2">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="text-sm">Your balance: <strong>{balance.toLocaleString()} coins</strong></span>
          </div>

          {/* Preset amounts */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Quick amounts</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? "default" : "outline"}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount('');
                  }}
                  className="flex items-center gap-2"
                >
                  <Coins className="w-4 h-4" />
                  {amount}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Custom amount</label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Enter coins"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedAmount(null);
                }}
                className="pl-10"
                min="1"
                max="1000"
              />
            </div>
          </div>

          {/* Insufficient balance warning */}
          {isValidAmount && !hasEnoughCoins && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              Insufficient coins. Top up your wallet first.
            </div>
          )}

          {/* Summary */}
          {isValidAmount && hasEnoughCoins && (
            <div className="bg-accent/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Tip amount:</span>
                <span className="font-semibold">{finalAmount} coins</span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Remaining balance:</span>
                <span>{(balance - finalAmount).toLocaleString()} coins</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1" disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handleTip}
              disabled={!isValidAmount || !hasEnoughCoins || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <SerkleLoader size="xs" className="text-primary-foreground" />
                  Processing...
                </div>
              ) : (
                `Tip ${finalAmount} coins`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
