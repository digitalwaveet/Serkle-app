import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { PauseReason } from '@/types/storyTypes';

interface StoryInteractiveOverlayProps {
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onPause: (reason: PauseReason) => void;
  onResume: (reason: PauseReason) => void;
  onSwipeDown: (dy: number, isSwiping: boolean) => void;
  hasLinkContent: boolean;
  onShowLinkOverlay: () => void;
  resharedPostId?: string;
  onNavigateToPost?: (postId: string) => void;
  swipeTranslateY: number;
  swipeScale: number;
  swipeOpacity: number;
  isSwipingDown: boolean;
  swipeDownY: number;
  children: React.ReactNode;
}

export const StoryInteractiveOverlay: React.FC<StoryInteractiveOverlayProps> = ({
  onNext,
  onPrevious,
  onClose,
  onPause,
  onResume,
  onSwipeDown,
  hasLinkContent,
  onShowLinkOverlay,
  resharedPostId,
  onNavigateToPost,
  swipeTranslateY,
  swipeScale,
  swipeOpacity,
  isSwipingDown,
  swipeDownY,
  children,
}) => {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);
  const [isHolding, setIsHolding] = useState(false);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const swipeDirectionLocked = useRef<'horizontal' | 'vertical' | null>(null);
  const activePointer = useRef<number | null>(null);
  useEffect(() => () => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); onResume('hold'); }, [onResume]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-story-controls]')) return;
    if (activePointer.current !== null) return;
    activePointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    
    swipeStartX.current = e.clientX;
    swipeStartY.current = e.clientY;
    swipeDirectionLocked.current = null;
    
    isHoldingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setIsHolding(true);
      onPause('hold');
    }, 400);
  }, [onPause]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== e.pointerId) return;
    if ((e.target as HTMLElement).closest('[data-story-controls]')) return;
    
    const dx = e.clientX - swipeStartX.current;
    const dy = e.clientY - swipeStartY.current;
    
    // Lock direction after 10px of movement
    if (!swipeDirectionLocked.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      swipeDirectionLocked.current = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
      // Cancel hold timer if swiping
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
    
    // Swipe-down-to-close: track vertical movement
    if (swipeDirectionLocked.current === 'vertical' && dy > 0) {
      onSwipeDown(dy, true);
    }
  }, [onSwipeDown]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const wasHolding = isHoldingRef.current;
    if (wasHolding) { isHoldingRef.current = false; setIsHolding(false); onResume('hold'); }
    
    // Clear the hold timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // Handle swipe-down-to-close
    if (isSwipingDown) {
      if (swipeDownY > 120) {
        onClose();
      }
      onSwipeDown(0, false);
      swipeDirectionLocked.current = null;
      return;
    }

    // Handle horizontal swipe
    const dx = e.clientX - swipeStartX.current;
    if (swipeDirectionLocked.current === 'horizontal') {
      if (dx < -50) {
        onNext();
      } else if (dx > 50) {
        onPrevious();
      }
      swipeDirectionLocked.current = null;
      return;
    }

    if (wasHolding) return;

    // It was a SHORT TAP — determine zone
    const bounds = e.currentTarget.getBoundingClientRect();
    const screenWidth = bounds.width;
    const tapX = swipeStartX.current - bounds.left;
    const leftThreshold = screenWidth * 0.3;

    if (tapX < leftThreshold) {
      onPrevious();
    } else {
      if (resharedPostId && tapX >= leftThreshold && tapX < screenWidth * 0.7) {
        onClose();
        if (onNavigateToPost) onNavigateToPost(resharedPostId);
        return;
      }
      
      if (hasLinkContent && tapX >= leftThreshold && tapX < screenWidth * 0.7) {
        onShowLinkOverlay();
      } else {
        onNext();
      }
    }
  }, [onNext, onPrevious, onClose, onResume, isSwipingDown, swipeDownY, onSwipeDown, hasLinkContent, onShowLinkOverlay, resharedPostId, onNavigateToPost]);

  const handlePointerCancel = useCallback(() => {
    activePointer.current = null;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      setIsHolding(false);
      onResume('hold');
    }
    onSwipeDown(0, false);
    swipeDirectionLocked.current = null;
  }, [onResume, onSwipeDown]);

  return (
    <div
      className="relative z-20 w-full h-full flex items-center justify-center touch-none"
      style={{
        transform: `translateY(${swipeTranslateY}px) scale(${swipeScale})`,
        opacity: swipeOpacity,
        transition: isSwipingDown ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s ease',
        willChange: 'transform, opacity',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="story-content-frame">
        {children}

        {/* Hold indicator */}
        {isHolding && (
          <div className="absolute inset-0 bg-black/10 pointer-events-none transition-opacity duration-150 z-[3]" />
        )}

        {/* Swipe down indicator */}
        {isSwipingDown && swipeDownY > 30 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="story-swipe-indicator" style={{ opacity: Math.min(1, swipeDownY / 120) }}>
              <ChevronUp className="size-5 text-white rotate-180" />
            </div>
          </div>
        )}

        {/* Gradient overlays for readability */}
        <div className="story-gradient-top pointer-events-none" />
        <div className="story-gradient-bottom pointer-events-none" />
      </div>
    </div>
  );
};
