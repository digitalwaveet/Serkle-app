import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { ImageAsset } from '../lib/imageAsset.ts';

const owner = '00000000-0000-4000-8000-000000000001';
let server: ViteDevServer, browser: Browser, base: string;
const objects = new Map<string, { bytes: Buffer; mime: string }>();
const assets = new Map<string, ImageAsset>();
const reads: string[] = [], errors: string[] = [];
let readDelay = 0, missing = false;
const bytesOf = async (req: any) => { const chunks: Uint8Array[] = []; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks); };
before(async () => {
  server = await createServer({
    configFile: false, root: process.cwd(), cacheDir: 'node_modules/.vite-images-ui', worker: { format: 'es' },
    optimizeDeps: { entries: ['src/tests/fixtures/image-previews-ui.tsx'], exclude: ['@jsquash/webp'] },
    resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
    plugins: [{
      name: 'isolated-images', enforce: 'pre',
      resolveId(id) {
        if (/\/(?:contexts\/UserContext|integrations\/supabase\/client)(?:\.tsx?)?$/.test(id.replace(/\\/g, '/'))) return '\0image-client';
      },
      load(id) {
        if (id === '\0image-client') return `import {createClient} from '@supabase/supabase-js';export const useUser=()=>({user:{id:'${owner}'}});export const supabase=createClient(location.origin,'fixture',{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer fixture-owner'}}});`;
      },
      configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const json = (data: unknown, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
        if (url.pathname === '/image-test') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/src/tests/fixtures/image-previews-ui.tsx"></script></body></html>'); return; }
        if (url.pathname === '/rest/v1/media_image_assets') {
          const path = url.searchParams.get('original_path')?.slice(3);
          return json(path && assets.has(path) ? [assets.get(path)] : []);
        }
        if (url.pathname.startsWith('/rest/v1/rpc/')) {
          const data = JSON.parse((await bytesOf(req)).toString());
          if (url.pathname.endsWith('prepare_image_asset')) {
            let asset = assets.get(data.p_path);
            if (!asset) { asset = { id: crypto.randomUUID(), bucket_id: data.p_bucket, original_path: data.p_path, original_name: data.p_name, original_mime: data.p_mime, original_bytes: objects.get(`${data.p_bucket}/${data.p_path}`)!.bytes.length, width: null, height: null, status: 'processing', variants: {} }; assets.set(data.p_path, asset); }
            return json(asset);
          }
          const asset = [...assets.values()].find(a => a.id === data.p_id)!;
          if (url.pathname.endsWith('complete_image_asset')) { Object.assign(asset, { status: 'ready', variants: data.p_variants, width: data.p_width, height: data.p_height }); return json(asset); }
          if (url.pathname.endsWith('fail_image_asset')) { asset.status = 'failed'; return json(null); }
        }
        if (url.pathname.startsWith('/storage/v1/object/sign/')) {
          const path = decodeURIComponent(url.pathname.slice('/storage/v1/object/sign/'.length));
          if (req.method === 'POST') return json({ signedURL: `/object/sign/${encodeURI(path)}?token=fixture` });
          reads.push(path);
          if (readDelay) await new Promise(r => setTimeout(r, readDelay));
          const object = objects.get(path);
          if (!object || missing) return json({ message: 'Not found' }, 404);
          res.setHeader('Content-Type', object.mime);
          if (url.searchParams.has('download')) res.setHeader('Content-Disposition', `attachment; filename="${url.searchParams.get('download')}"`);
          res.end(object.bytes); return;
        }
        if (url.pathname.startsWith('/storage/v1/object/') && req.method === 'POST') {
          const path = decodeURIComponent(url.pathname.slice('/storage/v1/object/'.length));
          if (objects.has(path)) return json({ statusCode: '409', message: 'The resource already exists' }, 409);
          const body = await bytesOf(req);
          const form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'Content-Type': req.headers['content-type']! }, body }).formData();
          const file = [...form.values()].find(v => typeof v !== 'string') as File;
          objects.set(path, { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type });
          return json({ Key: path, Id: crypto.randomUUID() });
        }
        next();
      }); },
    }],
  });
  await server.listen();
  const address = server.httpServer!.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-proxy-server'] });
});
after(async () => { await browser?.close(); await server?.close(); assert.deepEqual(errors, []); });
async function pageFor() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', acceptDownloads: true });
  await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/image-test');
  return page;
}
let original: Buffer, reference: string, asset: ImageAsset;
test('real browser upload preserves the original and generates three decodable WebP variants', async () => {
  original = await sharp({ create: { width: 2600, height: 1700, channels: 4, background: { r: 113, g: 58, b: 32, alpha: 0.4 } } }).png().toBuffer();
  const page = await pageFor();
  await page.getByLabel('Choose image').setInputFiles({ name: 'Original photo.png', mimeType: 'image/png', buffer: original });
  await expect(page.getByText('Uploaded', { exact: true })).toBeVisible({ timeout: 60000 });
  asset = [...assets.values()][0];
  reference = `${base}/storage/v1/object/public/post-media/${asset.original_path}`;
  assert.equal(asset.status, 'ready');
  assert.deepEqual(objects.get(`post-media/${asset.original_path}`)!.bytes, original);
  for (const size of ['thumb', 'display', 'full'] as const) {
    const image = objects.get(`post-media/${asset.variants[size]!.path}`)!;
    assert.equal(image.mime, 'image/webp');
    assert.equal((await sharp(image.bytes).metadata()).format, 'webp');
    assert.ok(image.bytes.length < original.length);
  }
  await expect(page.getByAltText('Uploaded photograph')).toBeVisible();
  assert.ok(reads.every(path => path.includes('.__serkle_preview_')), 'viewing must never fetch originals');
  await page.close();
});
test('skeleton remains until the browser finishes the delayed image response', async () => {
  readDelay = 1500;
  const page = await pageFor();
  await page.evaluate(src => (window as any).imageFixture.setSrc(src), reference);
  const preview = page.getByRole('region', { name: 'Image preview' });
  await expect(preview.getByTestId('image-skeleton')).toBeVisible();
  await mkdir('test-results/images', { recursive: true });
  await page.screenshot({ path: 'test-results/images/skeleton-loading.png', fullPage: true });
  await expect(preview.getByTestId('image-skeleton')).toHaveCount(0, { timeout: 10000 });
  await mkdir('test-results/images', { recursive: true });
  await page.screenshot({ path: 'test-results/images/webp-preview.png', fullPage: true });
  readDelay = 0; await page.close();
});
test('fullscreen uses a larger preview; original is fetched only by an explicit download click', async () => {
  reads.length = 0;
  const page = await pageFor();
  await page.evaluate(src => { (window as any).imageFixture.setSrc(src); (window as any).imageFixture.setSize('full'); }, reference);
  await expect(page.getByAltText('Uploaded photograph')).toBeVisible();
  assert.ok(reads.some(path => path.endsWith('_full.webp')));
  assert.ok(reads.every(path => path.includes('.__serkle_preview_')));
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download original' }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'Original photo.png');
  assert.deepEqual(await readFile((await download.path())!), original);
  assert.ok(reads.includes(`post-media/${asset.original_path}`));
  await page.close();
});
test('failed preview requests offer retry and do not fall back to the original', async () => {
  reads.length = 0; missing = true;
  const page = await pageFor();
  await page.evaluate(src => (window as any).imageFixture.setSrc(src), reference);
  const preview = page.getByRole('region', { name: 'Image preview' });
  await expect(preview.getByText('Image unavailable')).toBeVisible();
  assert.ok(reads.every(path => path.includes('.__serkle_preview_')));
  missing = false;
  await preview.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByAltText('Uploaded photograph')).toBeVisible();
  await page.close();
});
test('WASM fallback produces genuine WebP when the browser encoder returns PNG', async () => {
  const page = await pageFor();
  const results = await page.evaluate(async () => {
    const native = OffscreenCanvas.prototype.convertToBlob;
    OffscreenCanvas.prototype.convertToBlob = function () { return native.call(this, { type: 'image/png' }); };
    try {
      const canvas = new OffscreenCanvas(20, 30);
      canvas.getContext('2d')!.fillRect(0, 0, 20, 30);
      const input = await native.call(canvas, { type: 'image/png' });
      const image = await (window as any).imageFixture.encode(input);
      return Promise.all(Object.values(image.variants).map(async (v: any) => ({ type: v.blob.type, bytes: Array.from(new Uint8Array(await v.blob.arrayBuffer())) })));
    } finally { OffscreenCanvas.prototype.convertToBlob = native; }
  });
  for (const output of results) {
    assert.equal(output.type, 'image/webp');
    assert.equal((await sharp(Buffer.from(output.bytes)).metadata()).format, 'webp');
  }
  await page.close();
});
test('pending and failed processing metadata never triggers an original-image fallback', async () => {
  for (const status of ['processing', 'failed'] as const) {
    asset.status = status; reads.length = 0;
    const page = await pageFor();
    await page.evaluate(src => (window as any).imageFixture.setSrc(src), reference);
    const preview = page.getByRole('region', { name: 'Image preview' });
    if (status === 'processing') await expect(preview.getByTestId('image-skeleton')).toBeVisible();
    else await expect(preview.getByText('Preview could not be prepared')).toBeVisible();
    assert.equal(reads.length, 0);
    asset.status = 'ready';
    await page.evaluate(() => (window as any).imageFixture.queryClient.invalidateQueries({ queryKey: ['image-preview'] }));
    await expect(page.getByAltText('Uploaded photograph')).toBeVisible();
    await page.close();
  }
});
