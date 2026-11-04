import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'settings-autoplay-videos';

export const getAutoplaySetting = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
};

export const useAutoplaySettings = () => {
  const [autoplayEnabled, setAutoplayEnabled] = useState(getAutoplaySetting);

  const toggleAutoplay = useCallback((enabled: boolean) => {
    setAutoplayEnabled(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
      window.dispatchEvent(new CustomEvent('autoplay-setting-changed', { detail: enabled }));
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      setAutoplayEnabled((e as CustomEvent).detail);
    };
    window.addEventListener('autoplay-setting-changed', handler);
    return () => window.removeEventListener('autoplay-setting-changed', handler);
  }, []);

  return { autoplayEnabled, toggleAutoplay };
};
