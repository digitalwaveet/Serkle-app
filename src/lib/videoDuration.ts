/** Seconds are canonical; older Circle records may contain M:SS or H:MM:SS. */
export function parseVideoDuration(value: unknown): number | null {
  let seconds: number;
  if (typeof value === 'number') {
    seconds = value;
  } else if (typeof value === 'string' && value.trim()) {
    const text = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(text)) {
      seconds = Number(text);
    } else if (/^\d+:\d{2}(?:\.\d+)?$/.test(text) || /^\d+:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) {
      const parts = text.split(':').map(Number);
      if (parts.slice(1).some(part => part >= 60)) return null;
      seconds = parts.reduce((total, part) => total * 60 + part, 0);
    } else {
      return null;
    }
  } else {
    return null;
  }
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** Unknown, pending, zero and failed metadata never get a duration badge. */
export function formatVideoDuration(value: unknown): string | null {
  const seconds = parseVideoDuration(value);
  if (seconds === null) return null;
  // A real subsecond clip should not look like missing (0:00) metadata.
  const whole = Math.max(1, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const tail = String(whole % 60).padStart(2, '0');
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${tail}`
    : `${minutes}:${tail}`;
}

/**
 * Best effort only: an unsupported file or a slow connection must not block
 * uploading forever. Wait for later durationchange events when initial
 * metadata is zero/NaN, and probe unindexed WebM files reporting Infinity.
 */
export function extractVideoDuration(
  source: Blob | string,
  { signal, timeoutMs = 15000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<number | null> {
  if (signal?.aborted) return Promise.resolve(null);
  return new Promise(resolve => {
    let video: HTMLVideoElement | undefined;
    let objectUrl: string | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    let probed = false;
    const events = ['loadedmetadata', 'durationchange', 'loadeddata', 'seeked'];

    const finish = (seconds: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', failed);
      if (video) {
        events.forEach(event => video!.removeEventListener(event, read));
        video.removeEventListener('error', failed);
        // Stop pending reads before releasing the object URL.
        try { video.removeAttribute('src'); video.load(); } catch { /* cleanup */ }
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(seconds);
    };
    const failed = () => finish(null);
    const read = () => {
      if (!video || finished) return;
      const seconds = parseVideoDuration(video.duration);
      if (seconds !== null) {
        finish(seconds);
      } else if (video.duration === Infinity && !probed) {
        probed = true;
        try { video.currentTime = Number.MAX_SAFE_INTEGER; } catch { /* wait for metadata */ }
      }
    };

    try {
      video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      events.forEach(event => video!.addEventListener(event, read));
      video.addEventListener('error', failed);
      signal?.addEventListener('abort', failed, { once: true });
      timeout = setTimeout(failed, timeoutMs);
      if (typeof source === 'string') {
        video.src = source;
      } else {
        objectUrl = URL.createObjectURL(source);
        video.src = objectUrl;
      }
      video.load();
      read();
    } catch {
      failed();
    }
  });
}
