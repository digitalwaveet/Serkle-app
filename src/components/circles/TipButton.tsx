import React, { useState } from 'react';
import { DollarSign, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TipModal } from './TipModal';

interface TipButtonProps {
  postId: string;
  authorName: string;
  tipCount?: number;
  userHasTipped?: boolean;
  onTip?: (amount: number) => void;
  variant?: 'default' | 'card'; // card variant for post cards
}

export const TipButton: React.FC<TipButtonProps> = ({
  postId,
  authorName,
  tipCount = 0,
  userHasTipped = false,
  onTip,
  variant = 'default'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTipCount, setCurrentTipCount] = useState(tipCount);
  const [hasTipped, setHasTipped] = useState(userHasTipped);

  const handleTip = (amount: number) => {
    setCurrentTipCount(prev => prev + 1);
    setHasTipped(true);
    onTip?.(amount);
    setIsModalOpen(false);
  };

  return (
    <>
      <button 
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "flex items-center gap-2 transition-all duration-200 group",
          variant === 'card' 
            ? cn(
                "min-h-11 justify-center rounded-xl bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              )
            : cn(
                hasTipped 
                  ? "text-yellow-600 dark:text-yellow-400" 
                  : "text-muted-foreground hover:text-foreground"
              )
        )}
      >
        <div className={cn(
          "relative transition-all duration-200",
          variant === 'card' 
            ? "p-0"
            : cn(
                "p-1.5 rounded-full",
                hasTipped 
                  ? "bg-yellow-100 dark:bg-yellow-900/30" 
                  : "group-hover:bg-accent"
              )
        )}>
          <DollarSign className={cn(
            "size-4 transition-transform duration-200",
            "group-hover:scale-110"
          )} />
          {hasTipped && variant !== 'card' && (
            <Heart className="size-2 absolute -top-0.5 -right-0.5 fill-current text-yellow-600 dark:text-yellow-400" />
          )}
        </div>
        <span className="text-sm font-medium">
          {variant === 'card' ? 'Tip creator' : currentTipCount}
        </span>
        {variant === 'card' && currentTipCount > 0 && (
          <span aria-label={currentTipCount + (currentTipCount === 1 ? ' tip' : ' tips')} className="rounded-md bg-primary/10 px-1.5 text-xs">{currentTipCount}</span>
        )}
        {currentTipCount === 0 && variant !== 'card' && (
          <span className="text-xs opacity-70 hidden sm:block">Tip</span>
        )}
      </button>

      <TipModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTip={handleTip}
        authorName={authorName}
        postId={postId}
      />
    </>
  );
};
