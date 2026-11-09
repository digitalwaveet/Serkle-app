import { supabase } from '@/integrations/supabase/client';
import { detectImageMime, imageDigest, imageObject, imageUploadId, previewPath, type ImageAsset, type ImageBucket, type ImageSize } from './imageAsset';
import { generateImagePreviews } from './imagePreviews';

// Generated database types are refreshed after deployment. Keep this boundary
// narrow rather than weakening the types of callers or the generated schema.
const client = supabase as any;
export const IMAGE_URL_TTL = 300;
export const imageStorageOrigin = () => new URL(supabase.storage.from('post-media').getPublicUrl('origin').data.publicUrl).origin;
const inFlight = new Map<string, Promise<string>>();

async function putImmutable(bucket: ImageBucket, path: string, file: Blob) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream', cacheControl: '3600' });
  if (error && !['409', 'Duplicate'].includes(String((error as any).statusCode || (error as any).error)) && !/already exists|duplicate/i.test(error.message)) throw error;
}
export async function loadImageAsset(reference: string): Promise<ImageAsset | null> {
  const object = imageObject(reference, imageStorageOrigin());
  if (!object) return null;
  const { data, error } = await client.from('media_image_assets').select('*').eq('bucket_id', object.bucket).eq('original_path', object.path).maybeSingle();
  if (error) {
    // Legacy deployments keep their existing media working until SQL is applied.
    if (['42P01', 'PGRST205'].includes(error.code)) return null;
    throw new Error('Image information could not be loaded');
  }
  return data;
}
export async function signImageObject(bucket: ImageBucket, path: string, download?: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, IMAGE_URL_TTL, download ? { download } : undefined);
  if (error || !data?.signedUrl) throw new Error('Image unavailable or access expired');
  return data.signedUrl;
}
export async function requestImageRecovery(id: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to retry this upload');
  const response = await fetch('/api/image-previews', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ assetId: id }),
  });
  if (!response.ok) throw new Error('Preview processing is unavailable. Your original is safely stored.');
}

export function uploadImageWithPreviews(bucket: ImageBucket, folder: string, file: File, operationId: string): Promise<string> {
  const key = `${bucket}:${folder}:${operationId}:${imageUploadId(file)}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = upload(bucket, folder, file, operationId).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
async function upload(bucket: ImageBucket, folder: string, file: File, operationId: string) {
  if (!file.size || file.size > 50 * 1024 * 1024) throw new Error('Images must be between 1 byte and 50 MB');
  const mime = detectImageMime(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
  if (!mime) throw new Error('Choose a supported photo file. This file could not be identified as an image.');
  // Correct the upload MIME, without re-encoding or changing any original byte.
  if (file.type !== mime) file = new File([file], file.name, { type: mime, lastModified: file.lastModified });
  const hash = await imageDigest(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.__serkle_preview_/g, '_').slice(-90) || 'image';
  const path = `${folder}/serkle_image_v1_${operationId}-${hash.slice(0, 32)}-${safeName}`;
  const reference = bucket === 'chat-media' ? `chat-media://${path}` : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  // Always store the exact original before creating any derivative.
  await putImmutable(bucket, path, file);
  const { data, error } = await client.rpc('prepare_image_asset', { p_bucket: bucket, p_path: path, p_name: file.name, p_mime: mime, p_sha256: hash, p_operation: operationId });
  if (error || !data) throw new Error('Image processing setup is unavailable. Apply the image-preview database update and retry this draft.');
  const asset = data as ImageAsset;
  if (asset.status === 'ready') return reference;
  try {
    const generated = await generateImagePreviews(file);
    if (!generated) throw new Error('This image needs server processing');
    const variants: Record<string, unknown> = {};
    for (const size of ['thumb', 'display', 'full'] as ImageSize[]) {
      const preview = generated.variants[size], target = previewPath(path, size);
      await putImmutable(bucket, target, preview.blob);
      variants[size] = { path: target, width: preview.width, height: preview.height };
    }
    const { error: completeError } = await client.rpc('complete_image_asset', { p_id: asset.id, p_token: operationId, p_width: generated.width, p_height: generated.height, p_variants: variants, p_animated: false });
    if (completeError) throw completeError;
  } catch {
    const { error: failError } = await client.rpc('fail_image_asset', { p_id: asset.id, p_token: operationId });
    if (!failError) {
      // The durable queue remains recoverable even if the browser closes or the
      // optional server endpoint is temporarily unavailable. Never lose the file.
      try { await requestImageRecovery(asset.id); } catch { /* UI shows retryable processing state. */ }
    }
  }
  return reference;
}

export async function downloadOriginalImage(reference: string) {
  const object = imageObject(reference, imageStorageOrigin());
  if (!object) {
    const url = new URL(reference, location.href);
    if (!['https:', 'http:', 'blob:'].includes(url.protocol)) throw new Error('Invalid download');
    triggerDownload(url.href, 'image'); return;
  }
  // Look up metadata again on click; sign the ORIGINAL object without transform.
  const asset = await loadImageAsset(reference);
  const name = (asset?.original_name || object.path.split('/').pop() || 'image').replace(/[\x00-\x1f/\\]/g, '_');
  triggerDownload(await signImageObject(object.bucket, object.path, name), name);
}
function triggerDownload(href: string, name: string) {
  const anchor = document.createElement('a');
  anchor.href = href; anchor.download = name; anchor.rel = 'noopener';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
}
