import { extractVideoDuration } from './videoDuration';

/**
 * Generates a thumbnail image from a video file at a specific time.
 */
export const generateVideoThumbnail = async (
  file: File,
  timeInSeconds: number = 1
): Promise<{ blob: Blob; url: string }> => {
  const duration = await extractVideoDuration(file, { timeoutMs: 15000 });
  const targetTime = duration === null
    ? 0
    : Math.min(Math.max(0, timeInSeconds), Math.max(0, duration - 0.05));

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const sourceUrl = URL.createObjectURL(file);
    let settled = false;
    let captureStarted = false;
    const timeout = setTimeout(() => fail(new Error('Timed out while preparing the cover image')), 20000);

    const cleanup = () => {
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      try { video.removeAttribute('src'); video.load(); } catch { /* cleanup only */ }
      URL.revokeObjectURL(sourceUrl);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const capture = () => {
      if (settled || captureStarted || video.videoWidth <= 0 || video.videoHeight <= 0) return;
      captureStarted = true;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return fail(new Error('Could not prepare the cover canvas'));
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) return fail(new Error('Could not generate the cover image'));
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ blob, url: URL.createObjectURL(blob) });
        }, 'image/jpeg', 0.82);
      } catch (error) {
        fail(error instanceof Error ? error : new Error('Could not capture the video frame'));
      }
    };

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = sourceUrl;

    video.onloadedmetadata = () => {
      if (targetTime > 0) {
        try { video.currentTime = targetTime; } catch { /* loadeddata fallback */ }
      }
    };
    video.onloadeddata = () => {
      if (targetTime <= 0.05 || Math.abs(video.currentTime - targetTime) < 0.05) capture();
      else {
        try { video.currentTime = targetTime; } catch { capture(); }
      }
    };
    video.onseeked = capture;
    video.onerror = () => fail(new Error('Error loading video file'));
    video.load();
  });
};

/**
 * Captures a single JPEG frame from a live <video> element at its current playback position.
 */
export const captureFrameAt = (video: HTMLVideoElement): Promise<{ blob: Blob; url: string }> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('No canvas ctx')); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) resolve({ blob, url: URL.createObjectURL(blob) });
      else reject(new Error('Could not generate blob'));
    }, 'image/jpeg', 0.85);
  });

/**
 * Samples `count` evenly-spaced frame thumbnails from a video File.
 * Returns an array of { blob, url, time } objects for the filmstrip.
 */
export const sampleFrames = (
  file: File,
  count = 5
): Promise<{ blob: Blob; url: string; time: number }[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const srcUrl = URL.createObjectURL(file);
    video.src = srcUrl;

    const results: { blob: Blob; url: string; time: number }[] = [];
    let index = 0;
    let times: number[] = [];

    video.onloadedmetadata = () => {
      const dur = video.duration;
      times = Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * dur);
      video.currentTime = times[0];
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            results.push({ blob, url: URL.createObjectURL(blob), time: times[index] });
          }
          index++;
          if (index < times.length) {
            video.currentTime = times[index];
          } else {
            URL.revokeObjectURL(srcUrl);
            resolve(results);
          }
        }, 'image/jpeg', 0.75);
      } catch (err) {
        URL.revokeObjectURL(srcUrl);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(srcUrl);
      reject(new Error('Error loading video'));
    };
  });
};

