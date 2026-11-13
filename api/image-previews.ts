import type { IncomingMessage, ServerResponse } from 'node:http';
import { encodeCircleCover, processImageAsset } from '../server/imageProcessor.js';
import { createImagePreviewGateway, ImageGatewayError } from '../server/imagePreviewGateway.js';
import { isImageId } from '../supabase/functions/_shared/imagePreviewProtocol.js';

const SAFE_GATEWAY_DETAILS = new Set([
  'Image processor is not configured',
  'Invalid image operation',
  'Invalid Circle post',
  'Image maintenance authorization required',
  'Could not claim a Circle cover',
  'Could not save the Circle cover',
  'Could not queue a legacy image',
  'Image processing unavailable',
]);

export default async function handler(req: IncomingMessage & { body?: { assetId?: string; circlePostId?: string } }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, { error: 'Method not allowed' }); }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return reply(503, { error: 'Image processor is not configured' });
  const authorization = req.headers.authorization || '';
  if (!/^Bearer [^\s]+$/i.test(authorization)) return reply(401, { error: 'Sign in required' });
  const assetId = req.body?.assetId;
  const circlePostId = req.body?.circlePostId;
  if (!isImageId(assetId) && !isImageId(circlePostId)) return reply(400, { error: 'Invalid image' });
  if (assetId && circlePostId) return reply(400, { error: 'Choose one image operation' });

  try {
    const gateway = createImagePreviewGateway(url, key, { authorization });
    if (circlePostId) {
      const claim = await gateway.claimCircleCover(circlePostId);
      if (claim.status === 'idle') return reply(202, { status: 'pending' });
      if (claim.status !== 'claimed') return reply(404, { error: 'Image unavailable' });
      try {
        const image = await gateway.download(claim.job);
        const { cover, thumb } = await encodeCircleCover(image, claim.job.originalBytes);
        const completed = await gateway.completeCircleCover(claim.job, cover, thumb);
        return completed.stored
          ? reply(200, { status: 'ready' })
          : reply(409, { error: 'Preview completion could not be confirmed' });
      } catch {
        return reply(422, { error: 'Could not prepare preview. Original retained.' });
      }
    }
    const claim = await gateway.claim(assetId);
    if (claim.status === 'ready') return reply(200, { status: 'ready' });
    if (claim.status !== 'claimed') return reply(202, { status: 'pending' });
    try {
      return reply(200, await processImageAsset(gateway, claim.job));
    } catch {
      return reply(422, { error: 'Could not prepare preview. Original retained.' });
    }
  } catch (error) {
    if (error instanceof ImageGatewayError) {
      if (error.status === 401) return reply(401, { error: 'Sign in required' });
      if (error.status === 404) return reply(404, { error: 'Image unavailable' });
      console.error('image-previews gateway failure', { status: error.status, code: error.code, detail: error.detail });
      const reason = error.detail && SAFE_GATEWAY_DETAILS.has(error.detail)
        ? error.detail
        : `upstream_${error.status}`;
      return reply(503, {
        error: 'Image processing unavailable',
        reason,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    console.error('image-previews unexpected failure', error instanceof Error ? error.name : 'unknown');
    return reply(503, { error: 'Image processing unavailable', reason: 'gateway_request_failed' });
  }
}
