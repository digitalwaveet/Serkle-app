import type { ImageSize } from '../../supabase/functions/_shared/imagePreviewProtocol.ts';
export { IMAGE_PREVIEW_MARKER, IMAGE_PRESETS, previewPath, type ImageSize } from '../../supabase/functions/_shared/imagePreviewProtocol.ts';

export const IMAGE_PREVIEW_VERSION = 1;
const uploadIds = new WeakMap<Blob, string>();
export function imageUploadId(file: Blob) {
  let id = uploadIds.get(file);
  if (!id) { id = crypto.randomUUID(); uploadIds.set(file, id); }
  return id;
}
export type ImageBucket = 'chat-media' | 'post-media';
export interface ImageVariant { path: string; width: number; height: number; bytes: number }
export interface ImageAsset {
  id: string;
  bucket_id: ImageBucket;
  original_path: string;
  original_name: string;
  original_mime: string;
  original_bytes: number;
  original_sha256?: string;
  width: number | null;
  height: number | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  variants: Partial<Record<ImageSize, ImageVariant>>;
  animated?: boolean;
  processing_token?: string;
}
export interface ImageObject { bucket: ImageBucket; path: string }
export function originalImagePath(path: string) {
  return path.replace(/\.__serkle_preview_v1_(thumb|display|full)\.webp$/, '');
}
/** Signed URLs are never persisted as identity. Only resolve our own storage. */
export function imageObject(reference: string, origin: string): ImageObject | null {
  let bucket: string, path: string;
  if (reference.startsWith('chat-media://')) {
    bucket = 'chat-media'; path = reference.slice(13);
  } else {
    let url: URL;
    try { url = new URL(reference); } catch { return null; }
    if (url.origin !== origin || url.username || url.password) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/(chat-media|post-media)\/(.+)$/);
    if (!match) return null;
    bucket = match[1];
    try { path = decodeURIComponent(match[2]); } catch { throw new Error('Invalid image path'); }
  }
  if (/[\x00-\x1f\\]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..'))
    throw new Error('Invalid image path');
  return { bucket: bucket as ImageBucket, path: originalImagePath(path) };
}
export function fitImage(width: number, height: number, edge: number) {
  if (![width, height, edge].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid image dimensions');
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function isImageUpload(file: Blob, name = '') {
  return /^image\//i.test(file.type) || /\.(jpe?g|png|webp|heic|heif|gif|avif|bmp|tiff?)$/i.test(name);
}
/** Never pass SVG/HTML or a renamed document to an image decoder as a photo. */
export function detectImageMime(bytes: Uint8Array): string | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes[0] === 137 && text(1, 4) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return 'image/png';
  if (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a') return 'image/gif';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp';
  if (text(0, 2) === 'BM') return 'image/bmp';
  if ((text(0, 2) === 'II' && bytes[2] === 42 && bytes[3] === 0) || (text(0, 2) === 'MM' && bytes[2] === 0 && bytes[3] === 42)) return 'image/tiff';
  if (text(4, 8) === 'ftyp') {
    const brands = text(8, 64);
    if (/avif|avis/.test(brands)) return 'image/avif';
    if (/heic|heix|hevc|hevx|mif1|msf1/.test(brands)) return 'image/heic';
  }
  return null;
}
export async function imageDigest(file: Blob) {
  const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}
export function isAnimatedImage(bytes: Uint8Array, mime: string) {
  if (mime === 'image/gif') return true; // Preserve every GIF frame in the server processor.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if ((mime === 'image/avif' || /image\/hei[cf]/.test(mime)) && /avis|msf1/.test(String.fromCharCode(...bytes.subarray(8, 64)))) return true;
  if (mime === 'image/webp' && bytes.length >= 21) {
    // VP8X flag bit 1 signals animation. Do not scan compressed pixel bytes.
    return String.fromCharCode(...bytes.subarray(12, 16)) === 'VP8X' && !!(bytes[20] & 2);
  }
  if (mime === 'image/png') {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset), type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (type === 'acTL') return true;
      if (type === 'IDAT' || type === 'IEND') return false;
      offset += length + 12;
    }
  }
  return false;
}
