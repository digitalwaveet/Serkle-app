import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('public/manifest.json'));
const asset = src => path.join(root, 'public', src.replace(/^\//, ''));

test('identity preserves the previous start URL and uses in-scope launch URLs', () => {
  assert.equal(manifest.id, '/?app=serkle');
  assert.equal(manifest.start_url, '/?app=serkle');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.lang, 'en');
  assert.equal(manifest.dir, 'ltr');
  assert.equal(manifest.prefer_related_applications, false);
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.display_override, ['standalone', 'minimal-ui']);
  assert.equal(manifest.launch_handler.client_mode, 'auto');
});

test('screenshots exist and meet declared sizes and Chromium aspect-ratio limits', async () => {
  assert.ok(manifest.screenshots.length > 0);
  const ratios = new Map();
  for (const screenshot of manifest.screenshots) {
    assert.ok(screenshot.label);
    assert.ok(['narrow', 'wide'].includes(screenshot.form_factor));
    const { width, height, format } = await sharp(asset(screenshot.src)).metadata();
    assert.equal(screenshot.sizes, `${width}x${height}`);
    assert.equal(screenshot.type, `image/${format}`);
    assert.ok(Math.min(width, height) >= 320);
    assert.ok(Math.max(width, height) <= 3840);
    assert.ok(Math.max(width, height) / Math.min(width, height) <= 2.3);
    if (ratios.has(screenshot.form_factor)) assert.equal(width / height, ratios.get(screenshot.form_factor));
    ratios.set(screenshot.form_factor, width / height);
  }
});

test('install icons exist at their declared dimensions', async () => {
  const badge = await sharp(asset('/badge-72.png')).metadata();
  assert.equal(badge.width, 72);
  assert.equal(badge.height, 72);
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  for (const icon of manifest.icons) {
    assert.ok(existsSync(asset(icon.src)), icon.src);
    if (icon.sizes === 'any') continue;
    const { width, height } = await sharp(asset(icon.src)).metadata();
    assert.equal(icon.sizes, `${width}x${height}`);
  }
});

test('shortcuts point to actual app routes, not an unhandled query flag', () => {
  const routes = read('src/App.tsx');
  assert.equal(manifest.shortcuts[0].url, '/create/post');
  for (const shortcut of manifest.shortcuts) {
    assert.ok(routes.includes(`path="${shortcut.url}"`), shortcut.url);
    for (const icon of shortcut.icons) assert.ok(existsSync(asset(icon.src)));
  }
});

test('manifest and HTML use consistent branding with no duplicate source link', () => {
  const html = read('index.html');
  assert.ok(html.includes(`content="${manifest.theme_color}"`));
  assert.ok(html.includes(`background: ${manifest.background_color}`));
  assert.doesNotMatch(html, /<link\b[^>]*rel=["']manifest["']/i);
  const config = read('vite.config.ts');
  assert.ok(config.includes("readFileSync(path.resolve(__dirname, 'public/manifest.json')"));
});

test('unsupported integrations are not advertised without implementations', () => {
  for (const field of ['file_handlers', 'protocol_handlers', 'related_applications', 'iarc_rating_id', 'widgets', 'edge_side_panel', 'note_taking', 'scope_extensions']) {
    assert.equal(manifest[field], undefined, field);
  }
});

test('share target has a receiving worker and review page', () => {
  assert.equal(manifest.share_target.action, '/share-target');
  assert.equal(manifest.share_target.method, 'POST');
  assert.equal(manifest.share_target.enctype, 'multipart/form-data');
  assert.ok(read('src/sw.ts').includes("url.pathname === '/share-target'"));
  assert.ok(read('src/App.tsx').includes('path="/share"'));
});

test('production output has one manifest link, matching manifests, and shipped assets', () => {
  const html = read('dist/index.html');
  const links = html.match(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi) || [];
  assert.equal(links.length, 1);
  assert.ok(links[0].includes('/manifest.webmanifest'));
  assert.deepEqual(JSON.parse(read('dist/manifest.webmanifest')), manifest);
  assert.deepEqual(JSON.parse(read('dist/manifest.json')), manifest);
  for (const item of [...manifest.icons, ...manifest.screenshots]) {
    assert.ok(existsSync(path.join(root, 'dist', item.src.replace(/^\//, ''))), item.src);
  }
});
