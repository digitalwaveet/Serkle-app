import { useEffect, useRef } from 'react';

interface UseVisibilityHandlerOptions {
  onVisibilityChange: (isVisible: boolean) => void;
}

export const useVisibilityHandler = ({ onVisibilityChange }: UseVisibilityHandlerOptions) => {
  const wasVisible = useRef(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      
      if (wasVisible.current !== isVisible) {
        wasVisible.current = isVisible;
        onVisibilityChange(isVisible);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onVisibilityChange]);
};