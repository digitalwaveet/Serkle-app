export const STORY_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const STORY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const STORY_VIDEO_MAX_SECONDS = 60;
export const STORY_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm';

export function validateStoryFile(file: Blob): 'image' | 'video' {
  const kind = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? 'image'
    : ['video/mp4', 'video/webm'].includes(file.type) ? 'video' : null;
  if (!kind) throw new Error('Choose a JPG, PNG, WebP, MP4 or WebM file.');
  if (!file.size) throw new Error('This file is empty. Choose another file.');
  if (file.size > (kind === 'image' ? STORY_IMAGE_MAX_BYTES : STORY_VIDEO_MAX_BYTES)) {
    throw new Error(kind === 'image' ? 'Photos must be 15 MB or smaller.' : 'Videos must be 50 MB or smaller.');
  }
  return kind;
}

/** Decode before editing: a matching extension alone does not make media usable. */
export async function inspectStoryFile(file: Blob): Promise<'image' | 'video'> {
  const kind = validateStoryFile(file);
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const media = kind === 'image' ? new Image() : document.createElement('video');
      const finish = (error?: Error) => {
        clearTimeout(timer);
        media.onload = null;
        media.onerror = null;
        if (media instanceof HTMLVideoElement) { media.onloadedmetadata = null; media.removeAttribute('src'); media.load(); }
        error ? reject(error) : resolve();
      };
      const timer = setTimeout(() => finish(new Error('This file took too long to open. Try another file.')), 15000);
      media.onerror = () => finish(new Error('This media cannot be played on this device. Choose another file.'));
      if (media instanceof HTMLVideoElement) {
        media.preload = 'metadata';
        media.onloadedmetadata = () => finish(
          !Number.isFinite(media.duration) || media.duration <= 0 || media.duration > STORY_VIDEO_MAX_SECONDS
            ? new Error('Choose a video up to 60 seconds long.') : undefined);
      } else media.onload = () => finish(media.naturalWidth > 0 ? undefined : new Error('This image cannot be opened.'));
      media.src = url;
    });
    return kind;
  } finally { URL.revokeObjectURL(url); }
}

export function storyFileExtension(blob: Blob): string {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' } as Record<string, string>)[blob.type] || 'bin';
}

export function storyRelativeTime(value?: string): string {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time)) return 'Just now';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}
