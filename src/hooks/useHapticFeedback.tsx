import { useCallback } from 'react';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export const useHapticFeedback = () => {
  const triggerHaptic = useCallback((type: HapticType = 'light') => {
    // Check if we're on a mobile device with haptic support
    if ('navigator' in window && 'vibrate' in navigator) {
      try {
        switch (type) {
          case 'light':
            navigator.vibrate(10);
            break;
          case 'medium':
            navigator.vibrate(20);
            break;
          case 'heavy':
            navigator.vibrate(30);
            break;
          case 'success':
            navigator.vibrate([10, 50, 10]);
            break;
          case 'warning':
            navigator.vibrate([20, 100, 20]);
            break;
          case 'error':
            navigator.vibrate([50, 100, 50]);
            break;
          default:
            navigator.vibrate(10);
        }
      } catch (error) {
        // Silently fail if vibration is not supported
      }
    }

    // For iOS devices with haptic feedback API
    if ('window' in globalThis && (window as any).DeviceMotionEvent) {
      try {
        // Try to use iOS haptic feedback if available
        const impact = (window as any).Taptic?.impact;
        if (impact) {
          switch (type) {
            case 'light':
              impact('light');
              break;
            case 'medium':
              impact('medium');
              break;
            case 'heavy':
            case 'success':
            case 'error':
              impact('heavy');
              break;
            default:
              impact('light');
          }
        }
      } catch (error) {
        // Silently fail if not supported
      }
    }
  }, []);

  return { triggerHaptic };
};