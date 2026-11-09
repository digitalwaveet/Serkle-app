import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  IMAGE_BYTE_LIMIT, IMAGE_PRESETS, IMAGE_SIZES, isImageId, previewPath,
  type ImageClaim, type ImageSize,
} from '../_shared/imagePreviewProtocol.ts';

type ReadEnv = (name: string) => string | undefined;
const authOptions = { persistSession: false, autoRefreshToken: false };
const assetColumns = 'id,owner_id,bucket_id,original_path,original_bytes,original_sha256,status,processing_token,lease_until';
const JSON_BYTE_LIMIT = 16 * 1024;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function projectKey(env: ReadEnv, keyMap: string, singleKey: string, legacyKey: string) {
  const configured = env(keyMap);
  if (configured) {
    const { default: key } = JSON.parse(configured);
    if (typeof key === 'string' && key) return key;
  }
  return env(singleKey) || env(legacyKey);
}

function maintenanceAuthorized(provided: string, expected?: string) {
  if (!expected || expected.length < 32) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readOperation(request: Request) {
  if (!request.body || Number(request.headers.get('content-length')) > JSON_BYTE_LIMIT) return null;
  let bytes = 0;
  const body = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.length;
      if (bytes > JSON_BYTE_LIMIT) throw new Error('Image operation too large');
      controller.enqueue(chunk);
    },
  }));
  return new Response(body).json().catch(() => null);
}

// Validate the container signature and enforce the limit even for chunked
// requests. Stream the bytes to Storage to keep Edge memory use bounded.
function webpStream(body: ReadableStream<Uint8Array>) {
  const header = new Uint8Array(12);
  let bytes = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (bytes < header.length) {
        header.set(chunk.subarray(0, header.length - bytes), bytes);
        if (bytes + chunk.length >= header.length &&
            (String.fromCharCode(...header.subarray(0, 4)) !== 'RIFF' ||
             String.fromCharCode(...header.subarray(8)) !== 'WEBP')) {
          throw new Error('Invalid WebP');
        }
      }
      bytes += chunk.length;
      if (bytes > IMAGE_BYTE_LIMIT) throw new Error('Preview too large');
      controller.enqueue(chunk);
    },
    flush() {
      if (bytes < header.length) throw new Error('Invalid WebP');
    },
  }));
}

export function createImagePreviewHandler(env: ReadEnv) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      const url = env('SUPABASE_URL');
      const publishable = projectKey(env, 'SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
      const secret = projectKey(env, 'SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !publishable || !secret) return json({ error: 'Image processor is not configured' }, 503);

      const maintenanceKey = request.headers.get('x-image-maintenance-key');
      const maintenance = maintenanceKey !== null;
      if (maintenance && !maintenanceAuthorized(maintenanceKey, env('IMAGE_PREVIEW_MAINTENANCE_SECRET'))) {
        return json({ error: 'Image maintenance authorization required' }, 401);
      }

      let userId: string | undefined;
      let userClient;
      if (!maintenance) {
        const authorization = request.headers.get('authorization') || '';
        const token = authorization.match(/^Bearer ([^\s]+)$/i)?.[1];
        if (!token) return json({ error: 'Sign in required' }, 401);
        userClient = createClient(url, publishable, {
          auth: authOptions,
          global: { headers: { Authorization: authorization } },
        });
        const { data, error } = await userClient.auth.getUser(token);
        if (error || !data.user) return json({ error: 'Sign in required' }, 401);
        userId = data.user.id;
      }

      const binary = new URL(request.url).searchParams.get('action') === 'upload';
      const body = binary ? {
        action: 'upload',
        assetId: request.headers.get('x-image-asset-id'),
        lease: request.headers.get('x-image-lease'),
        size: request.headers.get('x-image-size'),
      } : await readOperation(request);
      if (!body || !['claim', 'upload', 'complete', 'fail', 'enqueue-legacy'].includes(body.action)) {
        return json({ error: 'Invalid image operation' }, 400);
      }

      const admin = createClient(url, secret, { auth: authOptions });
      if (body.action === 'enqueue-legacy') {
        if (!maintenance) return json({ error: 'Image maintenance authorization required' }, 403);
        const { data, error } = await admin.rpc('enqueue_legacy_image_previews', { p_limit: 1 });
        if (error) return json({ error: 'Could not queue a legacy image' }, 503);
        return json({ queued: data });
      }

      const queueClaim = maintenance && body.action === 'claim' && body.assetId == null;
      if (!queueClaim && !isImageId(body.assetId)) return json({ error: 'Invalid image' }, 400);
      const reader = userClient || admin;
      const assetQuery = queueClaim ? null : await reader.from('media_image_assets')
        .select(assetColumns).eq('id', body.assetId).maybeSingle();
      const asset = assetQuery?.data;
      if (!queueClaim && (!asset || (!maintenance && asset.owner_id !== userId))) {
        return json({ error: 'Image unavailable' }, 404);
      }

      if (body.action === 'claim') {
        if (asset?.status === 'ready') return json({ status: 'ready' } satisfies ImageClaim);
        const { data: claimed, error } = await admin.rpc('claim_image_asset', { p_id: asset?.id ?? null });
        if (error) return json({ error: 'Image processing unavailable' }, 503);
        if (!claimed) return json({ status: queueClaim ? 'idle' : 'pending' } satisfies ImageClaim);
        // For a user request, Storage checks the caller's current access again.
        const signed = await reader.storage.from(claimed.bucket_id).createSignedUrl(claimed.original_path, 300);
        if (signed.error || !signed.data?.signedUrl) {
          await admin.rpc('fail_image_asset', { p_id: claimed.id, p_token: claimed.processing_token });
          return json({ error: 'Original unavailable' }, 404);
        }
        return json({ status: 'claimed', job: {
          assetId: claimed.id, lease: claimed.processing_token, originalUrl: signed.data.signedUrl,
          originalBytes: claimed.original_bytes, originalSha256: claimed.original_sha256,
        } } satisfies ImageClaim);
      }

      if (!asset || !isImageId(body.lease) || asset.processing_token !== body.lease ||
          asset.status !== 'processing' || !(Date.parse(asset.lease_until) > Date.now())) {
        return json({ error: 'Image processing lease expired' }, 409);
      }
      const leaseArgs = { p_id: asset.id, p_token: body.lease };
      if (body.action === 'fail') {
        const { error } = await admin.rpc('fail_image_asset', leaseArgs);
        return error ? json({ error: 'Image processing unavailable' }, 503) : json({ status: 'failed' });
      }

      if (body.action === 'upload') {
        if (!binary || !IMAGE_SIZES.includes(body.size) || !request.body ||
            request.headers.get('content-type') !== 'image/webp') {
          return json({ error: 'Invalid WebP preview' }, 400);
        }
        if (Number(request.headers.get('content-length')) > IMAGE_BYTE_LIMIT) {
          return json({ error: 'Preview too large' }, 413);
        }
        const path = previewPath(asset.original_path, body.size);
        const { error } = await admin.storage.from(asset.bucket_id).upload(path, webpStream(request.body), {
          upsert: false, contentType: 'image/webp', cacheControl: '3600', duplex: 'half',
        });
        // An interrupted job can already have saved some variants. Keep them
        // immutable and let the completion RPC confirm the full set.
        const duplicate = error && (String('statusCode' in error ? error.statusCode : '') === '409' ||
          /already exists|duplicate/i.test(error.message));
        if (error && !duplicate) return json({ error: 'Preview storage unavailable' }, 502);
        return json({ status: 'stored' });
      }

      const result = body.result;
      if (!result || !Number.isInteger(result.width) || !Number.isInteger(result.height) ||
          result.width < 1 || result.height < 1 || result.width * result.height > 50_000_000 ||
          typeof result.animated !== 'boolean') return json({ error: 'Invalid image dimensions' }, 400);
      const variants: Partial<Record<ImageSize, { path: string; width: number; height: number }>> = {};
      for (const size of IMAGE_SIZES) {
        const variant = result.variants?.[size];
        const edge = IMAGE_PRESETS[size].edge;
        if (!variant || !Number.isInteger(variant.width) || !Number.isInteger(variant.height) ||
            variant.width < 1 || variant.height < 1 || variant.width > edge || variant.height > edge) {
          return json({ error: 'Invalid preview dimensions' }, 400);
        }
        variants[size] = { path: previewPath(asset.original_path, size), width: variant.width, height: variant.height };
      }
      const { error } = await admin.rpc('complete_image_asset', {
        ...leaseArgs, p_width: result.width, p_height: result.height, p_variants: variants, p_animated: result.animated,
      });
      return error ? json({ error: 'Preview completion could not be confirmed' }, 409) : json({ status: 'ready' });
    } catch {
      return json({ error: 'Image processing unavailable' }, 503);
    }
  };
}
