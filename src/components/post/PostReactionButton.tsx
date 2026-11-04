import React, { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import ReactionPicker from './ReactionPicker';

interface PostReactionButtonProps {
  isLiked: boolean;
  likesCount: number;
  userReaction?: string | null;
  onLike: (reactionType?: string) => void;
  onShowLikers: () => void;
  className?: string;
  variant?: 'default' | 'circle';
}

const REACTION_EMOJIS: Record<string, string> = {
  like: '❤️',
  love: '👍',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡'
};

const PostReactionButton: React.FC<PostReactionButtonProps> = ({
  isLiked,
  likesCount,
  userReaction,
  onLike,
  onShowLikers,
  className,
  variant = 'default'
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [currentReaction, setCurrentReaction] = useState(userReaction || 'like');
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  useEffect(() => {
    if (userReaction) {
      setCurrentReaction(userReaction);
    }
  }, [userReaction]);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowPicker(true);
      triggerHaptic('medium');
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleSelection = (emojiLabel: string) => {
    setCurrentReaction(emojiLabel);
    onLike(emojiLabel);
    setShowPicker(false);
  };

  const formatCount = (n: number) => {
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
    return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "m";
  };

  const isCircle = variant === 'circle';

  return (
    <div className={cn(
      "flex items-center gap-1", 
      isCircle ? "flex-1 justify-center gap-2 rounded-full backdrop-blur-sm px-4 py-2 text-sm font-medium text-white transition-smooth hover-scale bg-card/15 hover:bg-card/25" : "",
      isCircle && isLiked ? "bg-red-500/30" : "",
      className
    )}>
      <div className="relative">
        <button
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            e.stopPropagation();
            if (!showPicker) onLike(isLiked ? undefined : 'like');
          }}
          className={cn(
            "flex items-center justify-center rounded-full transition-colors active:scale-90",
            isCircle ? "p-0" : "p-2 hover:bg-muted"
          )}
        >
          {isLiked ? (
            <span className={cn("animate-in zoom-in duration-200", isCircle ? "text-lg" : "text-xl")}>
              {REACTION_EMOJIS[currentReaction] || '❤️'}
            </span>
          ) : (
            <Heart className={cn(isCircle ? "size-4" : "size-5", isCircle ? "text-white" : "text-muted-foreground")} />
          )}
        </button>

        {showPicker && (
          <div className="absolute bottom-full left-0 mb-2 z-50">
            <ReactionPicker 
              onSelect={handleSelection} 
              onClose={() => setShowPicker(false)} 
            />
          </div>
        )}
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          onShowLikers();
        }}
        className={cn(
          "font-medium hover:underline transition-all",
          isCircle ? "text-sm text-white" : "text-sm"
        )}
      >
        {formatCount(likesCount)}
      </button>
    </div>
  );
};

export default PostReactionButton;
