import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import sharp from 'sharp';
import handler from '../../api/image-previews.ts';
import { createImagePreviewHandler } from '../../supabase/functions/image-previews/handler.ts';
import { createImagePreviewGateway } from '../../server/imagePreviewGateway.ts';
import { encodeCircleCover, processImageAsset } from '../../server/imageProcessor.ts';
import { owner, outsider, operation } from './fixtures/image-assets-db.ts';

let http: Server;
let base: string;
let original: Buffer;
let claimed = false;
let revoked = false;
let reads = 0;
let writes = 0;
let claims = 0;
let failures = 0;
let queued = 0;
const id = '30000000-0000-4000-8000-000000000001';
const publishable = 'sb_publishable_fixture';
const adminKey = 'sb_secret_fixture';
const maintenanceKey = 'fixture-only-image-maintenance-key-2026';
const stored = new Set<string>();
const asset = {
  id, owner_id: owner, bucket_id: 'post-media', original_path: owner + '/api-original.png',
  original_bytes: 0, original_sha256: null, processing_token: operation, status: 'failed', lease_until: '',
};
const names = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const previous = names.map(name => process.env[name]);
const edge = createImagePreviewHandler(name => ({
  SUPABASE_URL: base,
  SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: publishable }),
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: adminKey }),
  IMAGE_PREVIEW_MAINTENANCE_SECRET: maintenanceKey,
}[name]));

before(async () => {
  original = await sharp({ create: { width: 800, height: 600, channels: 4, background: '#713a20' } }).png().toBuffer();
  asset.original_bytes = original.length;
  http = createServer(async (req, res) => {
    const url = new URL(req.url!, base);
    const path = url.pathname;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const json = (value: unknown, status = 200) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(value));
    };
    if (path === '/api/image-previews') {
      await handler(Object.assign(req, { body: body.length ? JSON.parse(body.toString()) : {} }), res);
      return;
    }
    if (path === '/functions/v1/image-previews') {
      assert.notEqual(req.headers.apikey, adminKey, 'the external request must not carry a service credential');
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(name, value);
      }
      const response = await edge(new Request(url, {
        method: req.method, headers, body: body.length ? new Uint8Array(body) : undefined,
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const token = req.headers.authorization;
    if (path === '/auth/v1/user') {
      assert.equal(req.headers.apikey, publishable);
      if (!['Bearer fixture-owner', 'Bearer fixture-outsider'].includes(token!)) {
        return json({ message: 'Invalid session' }, 401);
      }
      return json({ id: token === 'Bearer fixture-owner' ? owner : outsider, aud: 'authenticated' });
    }
    if (path === '/rest/v1/media_image_assets') {
      return json(revoked || url.searchParams.get('id') !== 'eq.' + id ? [] : [asset]);
    }
    if (path.startsWith('/rest/v1/rpc/')) {
      assert.equal(req.headers.apikey, adminKey, 'privileged RPCs belong to the Edge Function');
      const args = JSON.parse(body.toString());
      if (path.endsWith('claim_circle_cover_preview')) {
        assert.equal(args._origin, base);
        return json([{ post_id: id, lease: operation, object_path: asset.original_path, original_bytes: original.length }]);
      }
      if (path.endsWith('complete_circle_cover_preview')) {
        assert.equal(args._post_id, id);
        assert.equal(args._lease, operation);
        for (const [dataUrl, width] of [[args._cover, 640], [args._thumb, 24]]) {
          const metadata = await sharp(Buffer.from(dataUrl.split(',')[1], 'base64')).metadata();
          assert.equal(metadata.format, 'webp');
          assert.equal(metadata.width, width);
        }
        return json(true);
      }
      if (path.endsWith('claim_image_asset')) {
        claims++;
        if (claimed) return json(null);
        claimed = true;
        asset.status = 'processing';
        asset.lease_until = new Date(Date.now() + 300_000).toISOString();
        return json(asset);
      }
      if (path.endsWith('complete_image_asset')) {
        assert.equal(args.p_token, operation);
        assert.equal(Object.values<{ path: string }>(args.p_variants).every(
          variant => stored.has('/storage/v1/object/post-media/' + variant.path),
        ), true);
        asset.status = 'ready';
        return json(asset);
      }
      if (path.endsWith('fail_image_asset')) {
        failures++;
        asset.status = 'failed';
        return json(null);
      }
      if (path.endsWith('enqueue_legacy_image_previews')) {
        assert.equal(args.p_limit, 1);
        queued++;
        return json(1);
      }
    }
    if (path.startsWith('/storage/v1/object/sign/')) {
      const signedPath = '/object/sign/post-media/' + asset.original_path;
      assert.equal(path, '/storage/v1' + signedPath);
      if (req.method === 'POST') {
        assert.ok([publishable, adminKey].includes(String(req.headers.apikey)));
        return json({ signedURL: signedPath + '?token=fixture-download' });
      }
      assert.equal(req.headers.apikey, undefined);
      assert.equal(url.searchParams.get('token'), 'fixture-download');
      reads++;
      res.setHeader('Content-Type', 'image/png');
      res.end(original);
      return;
    }
    if (path.startsWith('/storage/v1/object/')) {
      assert.equal(req.headers.apikey, adminKey);
      assert.equal(req.headers['x-upsert'], 'false');
      assert.match(path, /\.__serkle_preview_v1_(thumb|display|full)\.webp$/);
      if (stored.has(path)) return json({ message: 'The resource already exists', statusCode: '409' }, 409);
      assert.equal((await sharp(body).metadata()).format, 'webp');
      stored.add(path);
      writes++;
      return json({ Key: path, Id: crypto.randomUUID() });
    }
    json({ error: 'Unknown route' }, 404);
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  assert.ok(address && typeof address === 'object');
  base = 'http://127.0.0.1:' + address.port;
  process.env.SUPABASE_URL = base;
  process.env.SUPABASE_PUBLISHABLE_KEY = publishable;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});
after(async () => {
  await new Promise<void>(resolve => http.close(() => resolve()));
  names.forEach((name, i) => {
    if (previous[i] === undefined) delete process.env[name];
    else process.env[name] = previous[i];
  });
});

function request(token?: string, method = 'POST') {
  return fetch(base + '/api/image-previews', {
    method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({ assetId: id }) : undefined,
  });
}

function edgeRequest(body: object, headers: Record<string, string> = {}) {
  return fetch(base + '/functions/v1/image-previews', {
    method: 'POST',
    headers: { apikey: publishable, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('recovery verifies the user through the Edge Function before reading storage', async () => {
  assert.equal((await request()).status, 401);
  assert.equal((await request('fixture-invalid')).status, 401);
  assert.equal((await request(undefined, 'GET')).status, 405);
  assert.equal(claims, 0);
  assert.equal(reads, 0);
});
test('a non-owner or revoked uploader cannot claim an image', async () => {
  assert.equal((await request('fixture-outsider')).status, 404);
  revoked = true;
  assert.equal((await request('fixture-owner')).status, 404);
  revoked = false;
  assert.equal(claims, 0);
  assert.equal(reads, 0);
});
test('a publishable key or ordinary session cannot start project-wide maintenance', async () => {
  assert.equal((await edgeRequest({ action: 'claim' })).status, 401);
  const headers = { Authorization: 'Bearer fixture-owner' };
  assert.equal((await edgeRequest({ action: 'claim' }, headers)).status, 400);
  assert.equal((await edgeRequest({ action: 'enqueue-legacy' }, headers)).status, 403);
  assert.equal((await edgeRequest({ action: 'claim-circle-cover' }, headers)).status, 403);
  assert.equal((await edgeRequest({ action: 'complete-circle-cover' }, headers)).status, 403);
  assert.equal((await edgeRequest({ action: 'claim' }, { 'x-image-maintenance-key': 'wrong-key' })).status, 401);
  assert.equal(queued, 0);
  assert.equal(claims, 0);
});
test('concurrent requests with the publishable key process one image and confirm its WebP previews', async () => {
  const responses = await Promise.all([request('fixture-owner'), request('fixture-owner')]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 202]);
  assert.equal(reads, 1);
  assert.equal(writes, 3);
  assert.equal(asset.status, 'ready');
  assert.ok(responses.every(r => r.headers.get('cache-control') === 'no-store'));
  const before = claims;
  assert.equal((await request('fixture-owner')).status, 200);
  assert.equal(claims, before);
});
test('decoder failure records recovery state without returning the signed URL', async () => {
  const previousOriginal = original;
  original = Buffer.from('not an image');
  asset.original_bytes = original.length;
  asset.status = 'failed';
  claimed = false;
  const response = await request('fixture-owner');
  assert.equal(response.status, 422);
  assert.equal(failures, 1);
  assert.equal(asset.status, 'failed');
  assert.deepEqual(await response.json(), { error: 'Could not prepare preview. Original retained.' });
  original = previousOriginal;
  asset.original_bytes = original.length;
});

test('maintenance generates separate WebP previews for an existing Circle cover', async () => {
  const gateway = createImagePreviewGateway(base, publishable, { 'x-image-maintenance-key': maintenanceKey });
  const claim = await gateway.claimCircleCover();
  assert.equal(claim.status, 'claimed');
  if (claim.status !== 'claimed') throw new Error('Expected a Circle cover job');
  const image = await gateway.download(claim.job);
  const { cover, thumb } = await encodeCircleCover(image, claim.job.originalBytes);
  assert.deepEqual(await gateway.completeCircleCover(claim.job, cover, thumb), { stored: true });
});
test('an expired lease and a different owner cannot upload or finalize previews', async () => {
  asset.status = 'processing';
  asset.lease_until = new Date(Date.now() - 1000).toISOString();
  const payload = { action: 'complete', assetId: id, lease: operation };
  assert.equal((await edgeRequest(payload, { Authorization: 'Bearer fixture-owner' })).status, 409);
  asset.lease_until = new Date(Date.now() + 300_000).toISOString();
  assert.equal((await edgeRequest(payload, { Authorization: 'Bearer fixture-outsider' })).status, 404);
  const upload = await fetch(base + '/functions/v1/image-previews?action=upload', {
    method: 'POST',
    headers: {
      apikey: publishable, Authorization: 'Bearer fixture-owner', 'Content-Type': 'image/webp',
      'x-image-asset-id': id, 'x-image-lease': outsider, 'x-image-size': 'thumb',
    },
    body: new Uint8Array(original),
  });
  assert.equal(upload.status, 409);
  assert.equal(writes, 3);
});
test('the optional maintenance worker claims a queued image and keeps already uploaded variants', async () => {
  asset.status = 'failed';
  claimed = false;
  const gateway = createImagePreviewGateway(base, publishable, { 'x-image-maintenance-key': maintenanceKey });
  assert.deepEqual(await gateway.enqueueLegacy(), { queued: 1 });
  const result = await gateway.claim();
  assert.equal(result.status, 'claimed');
  if (result.status !== 'claimed') return;
  assert.deepEqual(await processImageAsset(gateway, result.job), { status: 'ready' });
  assert.equal(queued, 1);
  assert.equal(writes, 3, 'recovery does not overwrite completed preview objects');
});
