import { useEffect, useState, type RefObject } from 'react';

// Be conservative: only acknowledge messages after the chat's end is on screen
// in a focused, visible window. Opening a chat or receiving data is not a read.
export function useVisibleChatEnd(rootRef: RefObject<HTMLElement>, endRef: RefObject<HTMLElement>, conversationId: string) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    const root = rootRef.current;
    const end = endRef.current;
    if (!root || !end || typeof IntersectionObserver === 'undefined') return;
    let intersects = false;
    const update = () => setVisible(intersects && document.visibilityState === 'visible' && document.hasFocus());
    const observer = new IntersectionObserver(([entry]) => {
      intersects = entry.isIntersecting && entry.intersectionRatio >= 1;
      update();
    }, { root, threshold: [0, 1] });
    observer.observe(end);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
    };
  }, [rootRef, endRef, conversationId]);
  return visible;
}
