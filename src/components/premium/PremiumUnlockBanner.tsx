import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumUnlockBannerProps {
  price: number;
  balance: number;
  onUnlock: () => void;
  isUnlocking: boolean;
  className?: string;
}

export const PremiumUnlockBanner: React.FC<PremiumUnlockBannerProps> = ({ 
  price, 
  balance, 
  onUnlock, 
  isUnlocking,
  className
}) => {
  const canAfford = balance >= price;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl bg-gradient-to-br from-tertiary/50 to-tertiary/80 dark:from-primary/20 dark:to-primary/10 border border-tertiary dark:border-primary p-6 my-6 shadow-elegant animate-in fade-in zoom-in duration-300",
      className
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-primary/20 rounded-full -translate-y-16 translate-x-16" />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          {/* Lock icon and Premium Content text removed per user request for cleaner look */}
        </div>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          This is a premium post. Pay <span className="font-bold text-primary">{price} 🪙</span> coins to unlock the full content.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={onUnlock}
            disabled={!canAfford || isUnlocking}
            className="flex-1 bg-gradient-primary hover:bg-gradient-primary/90 text-primary-foreground border-0 shadow-glow hover:shadow-xl transition-all duration-200 disabled:opacity-50 h-12"
          >
            {isUnlocking ? (
              <span className="flex items-center gap-2">
                <SerkleLoader size="xs" className="text-primary-foreground" />
                Unlocking...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Coins className="size-4" />
                Unlock for {price} 🪙
              </span>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>Your balance: <span className={cn("font-semibold", canAfford ? "text-primary" : "text-destructive")}>{balance} 🪙</span></span>
          {!canAfford && <span className="text-destructive font-medium">Insufficient coins — top up your wallet</span>}
        </div>
      </div>
    </div>
  );
};
