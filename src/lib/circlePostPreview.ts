import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';
import { fitImage } from '@/lib/imageAsset';

export const CIRCLE_HEADLINE_MAX_LENGTH = 120;

export function circleHeadlineChange(headline: string, current?: string | null) {
  const next = headline.trim() || null;
  return next === (current?.trim() || null) ? {} : { circle_headline: next };
}

export function isMissingCircleHeadlineColumn(error: { code?: string; message?: string }) {
  return (error.code === 'PGRST204' || error.code === '42703') &&
    error.message?.includes('circle_headline') === true;
}

export function circlePostExcerpt(content: string) {
  const sanitized = DOMPurify.sanitize(content, { RETURN_DOM_FRAGMENT: true });
  const firstBlock = sanitized.querySelector('p, h1, h2, h3, li, blockquote');
  const text = (firstBlock?.textContent ?? sanitized.textContent ?? '')
    .split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  return characters.length <= 280 ? text : characters.slice(0, 279).join('').trimEnd() + '…';
}

const noImages = { circle_preview_cover: null, circle_preview_thumb: null, circle_preview_full_frame: false };
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
    const encode = (edge: number, quality: number, limit: number) => {
      const { width, height } = fitImage(image.naturalWidth, image.naturalHeight, edge);
      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      const url = canvas.toDataURL('image/webp', quality);
      return url.startsWith('data:image/webp;base64,') && url.length <= limit ? url : null;
    };
    const cover = encode(640, 0.72, 100000) ?? encode(480, 0.62, 100000) ?? encode(360, 0.55, 100000);
    const thumb = encode(24, 0.5, 2000);
    return {
      circle_preview_cover: cover,
      circle_preview_thumb: thumb,
      circle_preview_full_frame: Boolean(cover && thumb),
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
  const read = () => supabase.rpc('get_circle_post_previews_v2', {
    _circle_id: circleId,
    _post_ids: postIds,
    _detail: detail,
  });
  const { data, error } = await read();
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    // A frontend may be ahead of the database during deployment. Keep displaying
    // safe legacy previews while headlines are unavailable.
    const { data: legacy } = await supabase.rpc('get_circle_post_previews', {
      _circle_id: circleId,
      _post_ids: postIds,
      _detail: true,
    });
    return (legacy ?? []).map(row => ({
      ...row, headline: null, full_frame: false,
      preview_text: detail ? row.preview_text : null,
    }));
  }
  if (error) return [];
  const rows = data ?? [];
  const missing = new Set(rows.filter(row => !row.preview_image || !row.full_frame).map(row => row.post_id));
  const candidates = recoverMissingIds
    .filter(id => missing.has(id) && (previewRetryAt.get(id) ?? 0) <= Date.now())
    .slice(0, 4);
  if (!candidates.length) return rows;
  const recovered = await Promise.all(candidates.map(recoverCirclePostPreview));
  if (!recovered.some(Boolean)) return rows;
  const refreshed = await read();
  return refreshed.error ? rows : refreshed.data ?? rows;
}
