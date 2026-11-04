import { useCallback, useRef } from 'react';
import { setFilePickerActive } from '@/utils/cacheManager';

/**
 * Wraps a file input click to prevent the PWA update notifier
 * from reloading the page while the system file picker is open.
 */
export const useFileInputGuard = () => {
  const activeRef = useRef(false);

  const guardedClick = useCallback((inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (!inputRef.current) return;
    setFilePickerActive(true);
    activeRef.current = true;
    inputRef.current.click();
  }, []);

  const guardedChange = useCallback(
    (handler: (e: React.ChangeEvent<HTMLInputElement>) => void) => {
      return (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilePickerActive(false);
        activeRef.current = false;
        handler(e);
      };
    },
    []
  );

  return { guardedClick, guardedChange };
};
