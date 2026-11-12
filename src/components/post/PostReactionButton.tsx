import React, { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import ReactionPicker from './ReactionPicker';

interface PostReactionButtonProps {
  isLiked: boolean;
  likesCount: number;
  userReaction?: string | null;
  onLike: (reactionType?: string) => void | Promise<unknown>;
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

interface LikeParticleConfig {
  id: number;
  kind: 'heart' | 'dot';
  color: string;
  size: number;
  tx: string;
  ty: string;
}

// 8 decorative particles: mix of tiny pink hearts and circular dots
// Colors: #F43774, #FF7AA4, #FFB6CD, #FF4B85, #FF9AB9
// Sizes: 5–10px | Radial dispersion: ~25–50px from heart center
const LIKE_PARTICLES: LikeParticleConfig[] = [
  { id: 0, kind: 'heart', color: '#F43774', size: 9,  tx: '0px',   ty: '-36px' },
  { id: 1, kind: 'dot',   color: '#FF7AA4', size: 6,  tx: '27px',  ty: '-26px' },
  { id: 2, kind: 'heart', color: '#FFB6CD', size: 8,  tx: '38px',  ty: '0px'   },
  { id: 3, kind: 'dot',   color: '#FF4B85', size: 7,  tx: '26px',  ty: '25px'  },
  { id: 4, kind: 'heart', color: '#FF9AB9', size: 9,  tx: '0px',   ty: '34px'  },
  { id: 5, kind: 'dot',   color: '#F43774', size: 5,  tx: '-27px', ty: '25px'  },
  { id: 6, kind: 'heart', color: '#FF4B85', size: 10, tx: '-37px', ty: '-2px'  },
  { id: 7, kind: 'dot',   color: '#FF7AA4', size: 6,  tx: '-26px', ty: '-27px' },
];

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
  const [heartAnim, setHeartAnim] = useState<'idle' | 'like' | 'unlike'>('idle');
  const [burstActive, setBurstActive] = useState(false);
  const [countAnim, setCountAnim] = useState(false);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLikedRef = useRef<boolean>(isLiked);
  const prevCountRef = useRef<number>(likesCount);
  const inFlightRef = useRef<boolean>(false);

  const { triggerHaptic } = useHapticFeedback();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (userReaction) {
      setCurrentReaction(userReaction);
    } else if (!isLiked) {
      setCurrentReaction('like');
    }
  }, [userReaction, isLiked]);

  // Trigger Like (540ms bounce + 680ms particle burst) or Unlike (200ms) only on state transitions
  useEffect(() => {
    const wasLiked = prevLikedRef.current;
    if (wasLiked === isLiked) return;
    prevLikedRef.current = isLiked;

    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);

    if (!wasLiked && isLiked) {
      setHeartAnim('like');
      heartTimerRef.current = setTimeout(() => setHeartAnim('idle'), 540);

      if (!reducedMotion) {
        setBurstActive(true);
        burstTimerRef.current = setTimeout(() => setBurstActive(false), 680);
      }
    } else if (wasLiked && !isLiked) {
      // Remove particle burst immediately on unlike
      setBurstActive(false);
      setHeartAnim('unlike');
      heartTimerRef.current = setTimeout(() => setHeartAnim('idle'), 210);
    }
  }, [isLiked, reducedMotion]);

  // Animate count on actual value change (380ms ease-out) without remounting
  useEffect(() => {
    if (prevCountRef.current === likesCount) return;
    prevCountRef.current = likesCount;

    if (reducedMotion) return;
    if (countTimerRef.current) clearTimeout(countTimerRef.current);
    setCountAnim(false);
    const raf = requestAnimationFrame(() => {
      setCountAnim(true);
      countTimerRef.current = setTimeout(() => setCountAnim(false), 380);
    });
    return () => cancelAnimationFrame(raf);
  }, [likesCount, reducedMotion]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (countTimerRef.current) clearTimeout(countTimerRef.current);
    };
  }, []);

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

  const triggerLikeOnce = async (reactionType?: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await onLike(reactionType);
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleSelection = (emojiLabel: string) => {
    setCurrentReaction(emojiLabel);
    setShowPicker(false);
    void triggerLikeOnce(emojiLabel);
  };

  const formatCount = (n: number) => {
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
    return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "m";
  };

  const isCircle = variant === 'circle';
  const showCustomEmoji = isLiked && currentReaction && currentReaction !== 'like' && REACTION_EMOJIS[currentReaction];

  return (
    <div className={cn(
      "inline-flex items-center",
      isCircle ? "flex-1 justify-center gap-2 rounded-full backdrop-blur-sm px-4 py-2 text-sm font-medium text-white transition-smooth hover-scale bg-card/15 hover:bg-card/25" : "gap-0.5",
      isCircle && isLiked ? "bg-red-500/30" : "",
      className
    )}>
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            e.stopPropagation();
            if (!showPicker) {
              void triggerLikeOnce(isLiked ? undefined : 'like');
            }
          }}
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
          aria-pressed={isLiked}
          className={cn(
            isCircle
              ? "flex items-center justify-center rounded-full p-0 transition-transform active:scale-90"
              : "engagement-btn engagement-btn--icon-only engagement-btn--like",
            !isCircle && isLiked && "engagement-btn--liked"
          )}
        >
          {showCustomEmoji ? (
            <span
              className={cn(
                "inline-flex items-center justify-center select-none leading-none",
                isCircle ? "text-lg" : "text-[20px]",
                heartAnim === 'like' && "engagement-heart--anim-like",
                heartAnim === 'unlike' && "engagement-heart--anim-unlike"
              )}
            >
              {REACTION_EMOJIS[currentReaction]}
            </span>
          ) : (
            <Heart
              strokeWidth={1.85}
              className={cn(
                isCircle ? "size-4 text-white" : "engagement-icon",
                !isCircle && (isLiked ? "engagement-heart--liked" : "engagement-heart--unliked"),
                isCircle && isLiked && "fill-[#F43774] text-[#F43774]",
                heartAnim === 'like' && "engagement-heart--anim-like",
                heartAnim === 'unlike' && "engagement-heart--anim-unlike"
              )}
            />
          )}

          {/* 8-Particle Radial Burst (680ms, pointer-events: none, cleaned up after completion) */}
          {burstActive && !reducedMotion && (
            <span className="engagement-particles" aria-hidden="true">
              {LIKE_PARTICLES.map((p) => (
                <span
                  key={p.id}
                  className="engagement-particle"
                  style={{
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    color: p.color,
                    '--tx': p.tx,
                    '--ty': p.ty,
                  } as React.CSSProperties}
                >
                  {p.kind === 'heart' ? (
                    <svg viewBox="0 0 24 24" className="w-full h-full fill-current overflow-visible">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  ) : (
                    <span
                      className="block rounded-full w-full h-full"
                      style={{ backgroundColor: p.color }}
                    />
                  )}
                </span>
              ))}
            </span>
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
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onShowLikers();
        }}
        aria-label={`${likesCount} likes. View users who liked this post`}
        className={cn(
          isCircle
            ? "font-medium hover:underline transition-all text-sm text-white"
            : "engagement-count-btn",
          !isCircle && isLiked && "engagement-count-btn--liked"
        )}
      >
        <span
          className={cn(
            !isCircle && "engagement-count",
            !isCircle && isLiked && "engagement-count--liked",
            countAnim && "engagement-count--anim"
          )}
        >
          {formatCount(likesCount)}
        </span>
      </button>
    </div>
  );
};

export default PostReactionButton;
