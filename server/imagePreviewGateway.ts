import type {
  CircleCoverClaim, CircleCoverJob, ImageClaim, ImagePreviewJob, ImagePreviewResult, ImageSize,
} from '../supabase/functions/_shared/imagePreviewProtocol.js';

export class ImageGatewayError extends Error {
  status: number;
  detail?: string;
  code?: string;
  constructor(status: number, detail?: string, code?: string) {
    super('Image gateway request failed');
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

async function readGatewayError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: unknown; code?: unknown } | null;
  const detail = typeof payload?.error === 'string' ? payload.error.slice(0, 120) : undefined;
  const code = typeof payload?.code === 'string' && /^[A-Za-z0-9_:-]{1,32}$/.test(payload.code)
    ? payload.code
    : undefined;
  return new ImageGatewayError(response.status, detail, code);
}

export function createImagePreviewGateway(
  supabaseUrl: string,
  publishableKey: string,
  credentials: { authorization: string } | { 'x-image-maintenance-key': string },
) {
  const endpoint = new URL('/functions/v1/image-previews', supabaseUrl);
  const headers = { apikey: publishableKey, ...credentials };

  async function post<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw await readGatewayError(response);
    return response.json();
  }

  const identity = (job: ImagePreviewJob) => ({ assetId: job.assetId, lease: job.lease });
  return {
    claim: (assetId?: string) => post<ImageClaim>({ action: 'claim', assetId }),
    enqueueLegacy: () => post<{ queued: number }>({ action: 'enqueue-legacy' }),
    claimCircleCover: (postId?: string) => post<CircleCoverClaim>({ action: 'claim-circle-cover', ...(postId ? { postId } : {}) }),
    completeCircleCover: (job: CircleCoverJob, cover: string, thumb: string) =>
      post<{ stored: boolean }>({ action: 'complete-circle-cover', postId: job.postId, lease: job.lease, cover, thumb }),
    async download(job: Pick<ImagePreviewJob, 'originalUrl'>) {
      const original = new URL(job.originalUrl);
      if (original.origin !== endpoint.origin || original.username || original.password ||
          !original.pathname.startsWith('/storage/v1/object/sign/')) {
        throw new Error('Invalid original image URL');
      }
      const response = await fetch(original, { redirect: 'error', signal: AbortSignal.timeout(45_000) });
      if (!response.ok) throw new Error('Original unavailable');
      return response.blob();
    },
    async upload(job: ImagePreviewJob, size: ImageSize, bytes: Uint8Array) {
      const target = new URL(endpoint);
      target.searchParams.set('action', 'upload');
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type': 'image/webp', 'x-image-asset-id': job.assetId,
          'x-image-lease': job.lease, 'x-image-size': size,
        },
        body: bytes as Uint8Array<ArrayBuffer>,
        redirect: 'error',
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw await readGatewayError(response);
      await response.body?.cancel();
    },
    complete: (job: ImagePreviewJob, result: ImagePreviewResult) =>
      post({ action: 'complete', ...identity(job), result }),
    fail: (job: ImagePreviewJob) => post({ action: 'fail', ...identity(job) }),
  };
}

export type ImagePreviewStorage = Pick<ReturnType<typeof createImagePreviewGateway>, 'download' | 'upload' | 'complete' | 'fail'>;
