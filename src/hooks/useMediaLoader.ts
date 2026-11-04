import { useState, useEffect, useCallback, useRef } from 'react';

// Internal session tracking (lives outside hook but inside module)
let sessionStats = {
  total: 0,
  ok: 0,
  retrying: 0,
  broken: 0
};

const updateSession = (diff: Partial<typeof sessionStats>) => {
  sessionStats = { ...sessionStats, ...diff };
};

// Expose a global report function for the user to call in console
if (typeof window !== 'undefined') {
  (window as any).__MEDIA_GUARD_REPORT__ = () => {
    console.group("%c📊 Media Guard Session Report", "color: #3b82f6; font-size: 14px; font-weight: bold; padding: 4px;");
    console.log(`%cTotal Media Tracked: %c${sessionStats.total}`, "color: #94a3b8", "font-weight: bold");
    console.log(`%c✅ Successfully Loaded: %c${sessionStats.ok}`, "color: #10b981", "font-weight: bold");
    console.log(`%c🔄 Currently Retrying: %c${sessionStats.retrying}`, "color: #fbbf24", "font-weight: bold");
    console.log(`%c❌ Broken / Failed: %c${sessionStats.broken}`, "color: #ef4444; text-decoration: underline", "font-weight: bold");
    console.log(`%cSuccess Rate: %c${sessionStats.total > 0 ? ((sessionStats.ok / sessionStats.total) * 100).toFixed(1) : 0}%`, "color: #94a3b8", "font-weight: bold");
    console.groupEnd();
  };
}

export type MediaStatus = 'loading' | 'retrying' | 'ok' | 'broken';
export type MediaType = 'image' | 'video' | 'pdf';

interface UseMediaLoaderOptions {
  maxRetries?: number;
  baseDelay?: number;
}

/**
 * Element-driven media loader.
 *
 * The browser's own <img>/<video> element is the source of truth: it loads the
 * media (respecting native lazy-loading and the per-host connection pool) and we
 * only react to its real onLoad / onError events. There is NO speculative
 * pre-fetch and NO artificial timeout, so a feed of N images no longer stampedes
 * the connection pool and falsely marks queued requests as "broken".
 *
 * On a genuine error we retry quietly with exponential backoff by re-pointing the
 * element at a cache-busted URL, and only surface a "broken" state once the
 * element has actually failed `maxRetries` times.
 */
export const useMediaLoader = (
  src: string | null | undefined,
  type: MediaType,
  options: UseMediaLoaderOptions = {}
) => {
  const {
    maxRetries = 3,
    baseDelay = 1500
  } = options;

  const [status, setStatus] = useState<MediaStatus>(src ? 'loading' : 'broken');
  const [attempt, setAttempt] = useState(1);
  // Bumped on each retry to force the element to re-fetch a fresh (cache-busted) URL.
  const [retryToken, setRetryToken] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // Guards against double-counting stats (e.g. React StrictMode double-invoke).
  const settledRef = useRef(false);

  // Reset whenever the source changes.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    settledRef.current = false;
    setAttempt(1);
    setRetryToken(0);
    setStatus(src ? 'loading' : 'broken');

    if (src) {
      console.log(`%c[MediaGuard] Loading started for ${type}: %c${src}`,
        "color: #3b82f6; font-weight: bold", "color: #64748b; font-style: italic");
      updateSession({ total: sessionStats.total + 1 });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [src, type]);

  const handleLoad = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);

    console.info(`%c[MediaGuard] OK ${type} %c(Loaded): %c${src}`,
      "color: #10b981; font-weight: bold", "color: #94a3b8", "color: #64748b; opacity: 0.6");
    updateSession({
      ok: sessionStats.ok + 1,
      retrying: status === 'retrying' ? Math.max(0, sessionStats.retrying - 1) : sessionStats.retrying
    });
    setStatus('ok');
  }, [type, src, status]);

  const handleError = useCallback(() => {
    if (settledRef.current) return;

    setAttempt(prev => {
      if (prev < maxRetries) {
        const nextDelay = baseDelay * Math.pow(2, prev - 1);
        console.warn(`%c[MediaGuard] Retrying ${type} %c(Attempt ${prev}/${maxRetries} in ${nextDelay / 1000}s): %c${src}`,
          "color: #fbbf24; font-weight: bold", "color: #94a3b8", "color: #64748b; font-style: italic");

        if (prev === 1) updateSession({ retrying: sessionStats.retrying + 1 });
        setStatus('retrying');

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setRetryToken(t => t + 1);
          setStatus('loading');
        }, nextDelay);

        return prev + 1;
      }

      // Out of retries — this media is genuinely unreachable.
      settledRef.current = true;
      console.error(`%c[MediaGuard] BROKEN ${type} %c(Failed after ${maxRetries} attempts): %c${src}`,
        "color: #ef4444; font-weight: bold", "color: #94a3b8", "color: #64748b; text-decoration: underline");
      updateSession({
        retrying: Math.max(0, sessionStats.retrying - 1),
        broken: sessionStats.broken + 1
      });
      setStatus('broken');
      return prev;
    });
  }, [type, src, maxRetries, baseDelay]);

  const handleRetry = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    settledRef.current = false;
    setAttempt(1);
    setStatus('loading');
    setRetryToken(t => t + 1);
  }, []);

  // The URL handed to the element. On retries we append a cache-buster so the
  // browser re-fetches instead of replaying a cached failure.
  const displaySrc = src
    ? (retryToken > 0
        ? `${src}${src.includes('?') ? '&' : '?'}_retry=${retryToken}`
        : src)
    : undefined;

  return {
    status,
    attempt,
    displaySrc,
    onLoad: handleLoad,
    onError: handleError,
    retry: handleRetry
  };
};
