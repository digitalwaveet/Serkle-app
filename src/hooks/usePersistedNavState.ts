import { useState, useCallback } from 'react';
import { type TabKey } from '@/hooks/useAppNav';
import { type FeedMode } from '@/components/FeedRelaxToggle';

const TAB_KEY = 'nav_activeTab';
const FEED_MODE_KEY = 'nav_feedMode';
const SCROLL_KEY = 'nav_scrollY';

function readSession<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeSession(key: string, value: unknown) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export const usePersistedNavState = () => {
  const [activeTab, _setActiveTab] = useState<TabKey>(() => readSession(TAB_KEY, 'home'));
  const [feedMode, _setFeedMode] = useState<FeedMode>(() => readSession(FEED_MODE_KEY, 'feed'));

  const setActiveTab = useCallback((tab: TabKey) => {
    _setActiveTab(tab);
    writeSession(TAB_KEY, tab);
  }, []);

  const setFeedMode = useCallback((mode: FeedMode) => {
    _setFeedMode(mode);
    writeSession(FEED_MODE_KEY, mode);
  }, []);

  const saveScrollPosition = useCallback(() => {
    writeSession(SCROLL_KEY, window.scrollY);
  }, []);

  const restoreScrollPosition = useCallback(() => {
    const y = readSession(SCROLL_KEY, 0);
    if (y > 0) {
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, []);

  return {
    activeTab,
    setActiveTab,
    feedMode,
    setFeedMode,
    saveScrollPosition,
    restoreScrollPosition,
  };
};
