/**
 * Generates a thumbnail image from a video file at a specific time.
 */
export const generateVideoThumbnail = (
  file: File,
  timeInSeconds: number = 1
): Promise<{ blob: Blob; url: string }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      // Seek to the requested time
      video.currentTime = Math.min(timeInSeconds, video.duration);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            resolve({ blob, url });
          } else {
            reject(new Error('Could not generate blob from canvas'));
          }
        }, 'image/jpeg', 0.8);
        
        // Cleanup tracking
        URL.revokeObjectURL(video.src);
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => {
      reject(new Error('Error loading video file'));
    };
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

