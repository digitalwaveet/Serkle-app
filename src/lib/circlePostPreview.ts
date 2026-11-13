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
const previewRecovery = new Map<string, Promise<boolean>>();
const previewRetryAt = new Map<string, number>();

async function recoverCirclePostPreview(postId: string) {
  const existing = previewRecovery.get(postId);
  if (existing) return existing;
  if ((previewRetryAt.get(postId) ?? 0) > Date.now()) return false;
  const request = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const response = await fetch('/api/image-previews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ circlePostId: postId }),
    });
    if (response.status === 200) {
      const payload = await response.json().catch(() => null);
      if (payload?.status === 'ready') return true;
    }
    // A processing lease or a decoder failure should not create a request loop.
    previewRetryAt.set(postId, Date.now() + (response.status === 202 ? 60_000 : 5 * 60_000));
    return false;
  })().catch(() => {
    previewRetryAt.set(postId, Date.now() + 60_000);
    return false;
  }).finally(() => previewRecovery.delete(postId));
  previewRecovery.set(postId, request);
  return request;
}

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

export async function getCirclePostPreviews(
  circleId: string,
  postIds: string[],
  detail = false,
  recoverMissingIds: string[] = [],
) {
  if (!postIds.length) return [];
  const read = () => supabase.rpc('get_circle_post_previews', {
    _circle_id: circleId,
    _post_ids: postIds,
    _detail: detail,
  });
  const { data, error } = await read();
  if (error) return [];
  const rows = data ?? [];
  const missing = new Set(rows.filter(row => !row.preview_image).map(row => row.post_id));
  const candidates = recoverMissingIds
    .filter(id => missing.has(id) && (previewRetryAt.get(id) ?? 0) <= Date.now())
    .slice(0, 4);
  if (!candidates.length) return rows;
  const recovered = await Promise.all(candidates.map(recoverCirclePostPreview));
  if (!recovered.some(Boolean)) return rows;
  const refreshed = await read();
  return refreshed.error ? rows : refreshed.data ?? rows;
}
