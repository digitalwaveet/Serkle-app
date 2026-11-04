const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8').replaceAll('import.meta.env.PROD', 'true').replaceAll('import.meta.env.DEV', 'false');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => mocks[name] || require(name),
    URL, URLSearchParams, FormData, File, Blob, Response, Uint8Array, crypto: { randomUUID }, console, setTimeout, clearTimeout, ...globals });
  return module.exports;
}
function shares() {
  const data = new Map();
  const storage = { createStore: () => ({}), get: async id => data.get(id), set: async (id, value) => data.set(id, value),
    del: async id => data.delete(id), entries: async () => [...data], update: async (id, fn) => data.set(id, fn(data.get(id))) };
  return { data, api: load('src/lib/shareDraft.ts', { 'idb-keyval': storage }) };
}
function form(text = 'Serkle local test') { const result = new FormData(); result.set('text', text); return result; }
test('shared text and links are normalized without network requests or HTML rendering', async () => {
  const { api } = shares(); const data = form('<b>Not HTML</b>'); data.set('title', 'Title'); data.set('url', 'https://example.com/');
  const parsed = await api.parseShare(data);
  assert.equal(parsed.text, 'Title\n\n<b>Not HTML</b>\n\nhttps://example.com/');
  assert.equal(parsed.files.length, 0);
});
test('empty shares, executable links and oversized text are rejected', async () => {
  const { api } = shares();
  await assert.rejects(api.parseShare(new FormData()));
  const data = form(); data.set('url', 'javascript:alert(1)'); await assert.rejects(api.parseShare(data));
  await assert.rejects(api.parseShare(form('x'.repeat(20001))));
});
test('a real PNG is accepted; MIME spoofing and SVG files are rejected', async () => {
  const { api } = shares();
  const data = form(''); data.append('files', new File([fs.readFileSync(path.join(root, 'public/icon-192.png'))], 'test.png', { type: 'image/png' }));
  assert.equal((await api.parseShare(data)).files.length, 1);
  const bad = form(); bad.append('files', new File(['not a png'], 'test.png', { type: 'image/png' })); await assert.rejects(api.parseShare(bad));
  const svg = form(); svg.append('files', new File(['<svg/>'], 'test.svg', { type: 'image/svg+xml' })); await assert.rejects(api.parseShare(svg));
});
test('image count and byte limits are enforced', async () => {
  const { api } = shares(); const many = form();
  for (let i = 0; i < 6; i++) many.append('files', new File(['x'], 'test.png', { type: 'image/png' }));
  await assert.rejects(api.parseShare(many));
  const large = form(); large.append('files', new File([new Uint8Array(11 * 1024 * 1024)], 'test.png', { type: 'image/png' }));
  await assert.rejects(api.parseShare(large));
});
test('drafts survive review, are claimed to one account, and cannot be discarded by another', async () => {
  const { api, data } = shares(); const id = await api.saveShareDraft(form());
  assert.ok(api.validShareId(id)); assert.equal((await api.readShareDraft(id, 'A')).owner, 'A');
  assert.equal(await api.readShareDraft(id, 'B'), undefined);
  await assert.rejects(api.removeShareDraft(id, 'B'));
  assert.ok(data.has(id)); await api.removeShareDraft(id, 'A'); assert.equal(data.has(id), false);
});
test('expired drafts are removed on access; inbox does not overwrite pending shares', async () => {
  const { api, data } = shares(); const id = await api.saveShareDraft(form());
  data.get(id).createdAt = Date.now() - api.SHARE_TTL - 1;
  assert.equal(await api.readShareDraft(id, 'A'), undefined); assert.equal(data.has(id), false);
  for (let i = 0; i < 3; i++) await api.saveShareDraft(form());
  await assert.rejects(api.saveShareDraft(form())); assert.equal(data.size, 3);
});
test('login return destination cannot be used as an open redirect', () => {
  const { api } = shares(); const target = `/share?draft=${randomUUID()}`;
  assert.equal(api.shareReturnPath(`?returnTo=${encodeURIComponent(target)}`), target);
  for (const value of ['https://evil.example', '//evil.example', '/admin', '/share?draft=x']) assert.equal(api.shareReturnPath(`?returnTo=${encodeURIComponent(value)}`), '/');
});
function worker(save = async () => 'fixture-id') {
  const listeners = {}, routes = []; let skipped = 0, claimed = 0, opened;
  const self = { __WB_MANIFEST: [], location: { origin: 'https://serkle.test' }, navigator: {},
    addEventListener: (name, fn) => listeners[name] = fn, skipWaiting: async () => { skipped++; },
    clients: { claim: async () => { claimed++; }, matchAll: async () => [], openWindow: async url => { opened = url; } } };
  class NavigationRoute { constructor(handler, options) { this.handler = handler; this.options = options; } }
  load('src/sw.ts', {
    'workbox-precaching': { precacheAndRoute() {}, cleanupOutdatedCaches() {}, createHandlerBoundToURL: url => url },
    'workbox-routing': { registerRoute: (...args) => routes.push(args), NavigationRoute },
    'workbox-strategies': { NetworkOnly: class {} }, './lib/shareDraft': { saveShareDraft: save },
  }, { self });
  return { listeners, routes, get skipped() { return skipped; }, get claimed() { return claimed; }, get opened() { return opened; } };
}
test('worker waits for explicit update approval and claims clients on activation', async () => {
  const sw = worker(); let pending;
  assert.equal(sw.skipped, 0);
  sw.listeners.message({ data: { type: 'SKIP_WAITING' }, waitUntil: p => pending = p }); await pending;
  assert.equal(sw.skipped, 1);
  sw.listeners.activate({ waitUntil: p => pending = p }); await pending; assert.equal(sw.claimed, 1);
});
test('offline app shell is enabled without hijacking API, storage or asset routes', () => {
  const nav = worker().routes[0][0]; assert.equal(nav.handler, '/index.html');
  for (const url of ['/api/test', '/auth/callback', '/storage/object', '/share-target', '/assets/app.js']) assert.ok(nav.options.denylist.some(re => re.test(url)), url);
  for (const url of ['/messages', '/create/post', '/share?draft=id']) assert.ok(!nav.options.denylist.some(re => re.test(url)), url);
});
test('share POST redirects to review after local persistence, and errors redirect safely', async () => {
  let saved = 0;
  const sw = worker(async () => { saved++; return 'fixture-id'; });
  const route = sw.routes.find(args => args[2] === 'POST');
  assert.equal(route[0]({ url: new URL('https://elsewhere.test/share-target') }), false);
  const response = await route[1]({ request: { formData: async () => form() } });
  assert.equal(saved, 1); assert.equal(response.status, 303); assert.match(response.headers.get('location'), /\/share\?draft=fixture-id$/);
  const fail = worker(async () => { throw new Error('quota'); }).routes.find(args => args[2] === 'POST');
  assert.match((await fail[1]({ request: { formData: async () => form() } })).headers.get('location'), /error=invalid$/);
});
test('notification links cannot navigate outside Serkle', async () => {
  const sw = worker(); let pending;
  sw.listeners.notificationclick({ notification: { close() {}, data: { url: 'https://evil.example' } }, waitUntil: p => pending = p });
  await pending; assert.equal(sw.opened, 'https://serkle.test/notifications');
});
test('background sync rejects when no window exists rather than falsely reporting completion', async () => {
  const sw = worker(); let pending;
  sw.listeners.sync({ tag: 'chat-sync', waitUntil: p => pending = p });
  await assert.rejects(pending, /No authenticated window/);
});
function updater() {
  const values = new Map(); let changed, timer, reloads = 0, sent = 0;
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const serviceWorker = { getRegistration: async () => ({ waiting: { postMessage: () => { sent++; } } }),
    addEventListener: (name, fn) => { changed = fn; }, removeEventListener: () => { changed = undefined; } };
  const api = load('src/utils/cacheManager.ts', {}, { sessionStorage: storage, localStorage: storage,
    navigator: { serviceWorker }, window: { location: { reload: () => { reloads++; } } },
    setTimeout: fn => { timer = fn; return 1; }, clearTimeout() {} });
  return { api, get sent() { return sent; }, get reloads() { return reloads; }, change: () => changed(), timeout: () => timer() };
}
test('update reload waits for controllerchange, without clearing caches or receipts', async () => {
  const state = updater(); const pending = state.api.cacheManager.applyUpdate(); await new Promise(setImmediate);
  assert.equal(state.sent, 1); assert.equal(state.reloads, 0); state.change(); await pending; assert.equal(state.reloads, 1);
});
test('update timeout does not reload; file picker guard blocks update', async () => {
  const state = updater(); const pending = state.api.cacheManager.applyUpdate(); await new Promise(setImmediate);
  state.timeout(); await assert.rejects(pending, /timed out/); assert.equal(state.reloads, 0);
  state.api.setFilePickerActive(true); await assert.rejects(state.api.cacheManager.applyUpdate(), /selecting/);
});
