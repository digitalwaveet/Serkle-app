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
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "flex items-center gap-2 transition-all duration-200 group",
          variant === 'card' 
            ? cn(
                "w-full justify-center py-2 text-white",
                hasTipped 
                  ? "text-yellow-300" 
                  : "hover:text-yellow-200"
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
        <span className={cn(
          "text-sm font-medium",
          variant === 'card' && "text-white"
        )}>
          {currentTipCount}
        </span>
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