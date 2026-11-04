import { useState, useCallback, TouchEvent } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeConfig {
  threshold?: number;
  preventDefaultTouchmoveEvent?: boolean;
  trackMouse?: boolean;
}

export const useSwipeGestures = (
  handlers: SwipeHandlers,
  config: SwipeConfig = {}
) => {
  const {
    threshold = 50,
    preventDefaultTouchmoveEvent = false,
    trackMouse = false
  } = config;

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (preventDefaultTouchmoveEvent) {
      e.preventDefault();
    }
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  }, [preventDefaultTouchmoveEvent]);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > threshold;
    const isRightSwipe = distanceX < -threshold;
    const isUpSwipe = distanceY > threshold;
    const isDownSwipe = distanceY < -threshold;

    // Determine which direction had the greater movement
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      // Horizontal swipe
      if (isLeftSwipe && handlers.onSwipeLeft) {
        handlers.onSwipeLeft();
      } else if (isRightSwipe && handlers.onSwipeRight) {
        handlers.onSwipeRight();
      }
    } else {
      // Vertical swipe
      if (isUpSwipe && handlers.onSwipeUp) {
        handlers.onSwipeUp();
      } else if (isDownSwipe && handlers.onSwipeDown) {
        handlers.onSwipeDown();
      }
    }
  }, [touchStart, touchEnd, threshold, handlers]);

  const onMouseDown = useCallback((e: any) => {
    if (!trackMouse) return;
    setTouchEnd(null);
    setTouchStart({
      x: e.clientX,
      y: e.clientY
    });
  }, [trackMouse]);

  const onMouseMove = useCallback((e: any) => {
    if (!trackMouse) return;
    setTouchEnd({
      x: e.clientX,
      y: e.clientY
    });
  }, [trackMouse]);

  const onMouseUp = useCallback(() => {
    if (!trackMouse) return;
    onTouchEnd();
  }, [trackMouse, onTouchEnd]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    ...(trackMouse && {
      onMouseDown,
      onMouseMove,
      onMouseUp
    })
  };
};