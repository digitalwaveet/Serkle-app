import type { IncomingMessage, ServerResponse } from 'node:http';
import { processImageAsset } from '../server/imageProcessor.ts';
import { createImagePreviewGateway, ImageGatewayError } from '../server/imagePreviewGateway.ts';
import { isImageId } from '../supabase/functions/_shared/imagePreviewProtocol.ts';

export default async function handler(req: IncomingMessage & { body?: { assetId?: string } }, res: ServerResponse) {
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
  if (!isImageId(assetId)) return reply(400, { error: 'Invalid image' });

  try {
    const gateway = createImagePreviewGateway(url, key, { authorization });
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
    }
    return reply(503, { error: 'Image processing unavailable' });
  }
}
