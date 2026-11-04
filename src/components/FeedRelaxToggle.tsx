import React from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type FeedMode = 'feed' | 'relax';

interface FeedRelaxToggleProps {
  activeMode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
}

export const FeedRelaxToggle: React.FC<FeedRelaxToggleProps> = ({
  activeMode,
  onModeChange,
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <div className="sticky top-10 z-40 py-2 px-4 border-b border-muted bg-background/95 backdrop-blur-sm backdrop-saturate-150 shadow-sm">
      <div 
        role="tablist" 
        aria-label="Feed and Relax modes"
        className="relative flex bg-muted rounded-full p-1 max-w-xs mx-auto"
      >
        {/* Sliding background indicator */}
        <div
          className={cn(
            "absolute top-1 bottom-1 w-1/2 bg-background rounded-full shadow-sm border border-border",
            reducedMotion 
              ? "transition-none" 
              : "transition-transform duration-300 ease-out",
            activeMode === 'relax' && "translate-x-full"
          )}
          aria-hidden="true"
        />
        
        {/* Feed button */}
        <button
          role="tab"
          aria-selected={activeMode === 'feed'}
          aria-current={activeMode === 'feed' ? 'page' : undefined}
          aria-label="View feed posts"
          onClick={() => onModeChange('feed')}
          className={cn(
            "relative z-10 flex-1 px-4 py-1 text-sm font-medium rounded-full text-center",
            reducedMotion 
              ? "transition-none" 
              : "transition-colors duration-200",
            activeMode === 'feed' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Feed
        </button>
        
        {/* Relax button */}
        <button
          role="tab"
          aria-selected={activeMode === 'relax'}
          aria-current={activeMode === 'relax' ? 'page' : undefined}
          aria-label="View relax videos"
          onClick={() => onModeChange('relax')}
          className={cn(
            "relative z-10 flex-1 px-4 py-1 text-sm font-medium rounded-full text-center",
            reducedMotion 
              ? "transition-none" 
              : "transition-colors duration-200",
            activeMode === 'relax' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Relax
        </button>
      </div>
    </div>
  );
};