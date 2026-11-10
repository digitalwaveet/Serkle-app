import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';

export function circlePostExcerpt(content: string) {
  const sanitized = DOMPurify.sanitize(content, { RETURN_DOM_FRAGMENT: true });
  const firstBlock = sanitized.querySelector('p, h1, h2, h3, li, blockquote');
  const text = (firstBlock?.textContent ?? sanitized.textContent ?? '')
    .split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  return characters.length <= 280 ? text : characters.slice(0, 279).join('').trimEnd() + '…';
}

const noImages = { circle_preview_cover: null, circle_preview_thumb: null };

export async function makeCirclePreviewImages(source?: Blob | string) {
  if (!source) return noImages;
  const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = objectUrl ?? (source as string);
    await image.decode();

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return noImages;
    const encode = (width: number, quality: number, limit: number) => {
      canvas.width = Math.min(width, image.naturalWidth);
      canvas.height = Math.max(1, Math.round(canvas.width / 2.24));
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const scaledWidth = image.naturalWidth * scale;
      const scaledHeight = image.naturalHeight * scale;
      context.drawImage(image, (canvas.width - scaledWidth) / 2, (canvas.height - scaledHeight) / 2, scaledWidth, scaledHeight);
      const url = canvas.toDataURL('image/webp', quality);
      return url.startsWith('data:image/webp;base64,') && url.length <= limit ? url : null;
    };
    return {
      circle_preview_cover: encode(640, 0.66, 100000) ?? encode(360, 0.55, 100000),
      circle_preview_thumb: encode(24, 0.5, 2000),
    };
  } catch {
    return noImages;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function getCirclePostPreviews(circleId: string, postIds: string[], detail = false) {
  if (!postIds.length) return [];
  const { data, error } = await supabase.rpc('get_circle_post_previews', {
    _circle_id: circleId,
    _post_ids: postIds,
    _detail: detail,
  });
  if (error) return [];
  return data ?? [];
}
