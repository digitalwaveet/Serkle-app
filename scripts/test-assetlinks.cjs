const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const links = read('public/.well-known/assetlinks.json');
const config = read('vercel.json');

test('association matches the supplied PWABuilder APK identity and certificate', () => {
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(links[0].target.namespace, 'android_app');
  assert.equal(links[0].target.package_name, 'app.vercel.serkle_flash.twa');
  assert.deepEqual(links[0].target.sha256_cert_fingerprints, [
    'BF:C8:B7:5E:EB:22:8B:5C:F1:EF:62:9C:74:E6:C3:C5:C0:0F:0C:42:F2:51:CB:41:FC:65:45:4A:3A:F1:04:7E',
  ]);
});

test('verification paths bypass the SPA rewrite while application routes still work', () => {
  const rewrite = config.rewrites.find(route => route.destination === '/index.html');
  const matcher = new RegExp(`^${rewrite.source}$`);
  for (const url of ['/.well-known', '/.well-known/assetlinks.json', '/.well-known/missing.json']) assert.equal(matcher.test(url), false, url);
  for (const url of ['/', '/messages', '/messages/example', '/create/post', '/share', '/login']) assert.equal(matcher.test(url), true, url);
});

test('association response is JSON and uses a short cache without weakening security headers', () => {
  const association = config.headers.find(rule => rule.source === '/.well-known/assetlinks.json');
  assert.ok(association.headers.some(header => header.key === 'Content-Type' && header.value.startsWith('application/json')));
  assert.ok(association.headers.some(header => header.key === 'Cache-Control' && header.value.includes('max-age=300')));
  const globalHeaders = config.headers.find(rule => rule.source === '/(.*)').headers;
  assert.ok(globalHeaders.some(header => header.key === 'X-Content-Type-Options' && header.value === 'nosniff'));
  assert.ok(globalHeaders.some(header => header.key === 'Strict-Transport-Security'));
});

test('build ships the exact association in the hidden .well-known directory', () => {
  assert.deepEqual(read('dist/.well-known/assetlinks.json'), links);
});
