const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');

// Exercise the real modules with isolated storage/network boundaries. No accounts
// or live backend are used by this suite.
function load(file, overrides = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS,
    esModuleInterop: true, target: ts.ScriptTarget.ES2020,
  }}).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports,
    require: id => overrides[id] || require(id),
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout,
    navigator: { onLine: true }, crypto: { randomUUID: () => 'test-id' }, ...globals });
  return module.exports;
}
const status = load('src/lib/messageStatus.ts');
const unread = load('src/lib/chatUnread.ts');
const Delivery = load('src/components/messages/MessageDeliveryStatus.tsx', { '@/lib/messageStatus': status }).default;

test('only an actual read receipt produces a double check', () => {
  for (const oldStatus of ['sent', 'delivered', 'read', undefined]) {
    assert.equal(status.getMessageStatus(oldStatus, 42, 41), 'sent');
    assert.equal(status.getMessageStatus(oldStatus, 42, 42), 'read');
  }
  for (const state of ['pending', 'sending', 'failed']) assert.equal(status.getMessageStatus(state, 42, 99), state);
  assert.equal(status.getMessageStatus('sent', undefined, 99), 'sent');
});

test('delivery UI exposes status labels and a keyboard-accessible visible retry', () => {
  for (const [syncStatus, label] of [['pending','Queued'], ['sending','Sending'], ['sent','Sent']]) {
    const html = renderToStaticMarkup(React.createElement(Delivery, { syncStatus, onRetry() {} }));
    assert.match(html, new RegExp(`aria-label="${label}"`));
    assert.doesNotMatch(html, /SERKLE|serkle-loader/);
  }
  let retried = false;
  const button = Delivery({ syncStatus: 'failed', onRetry: () => { retried = true; } });
  assert.equal(button.type, 'button');
  button.props.onClick({ stopPropagation() {} });
  assert.equal(retried, true);
  const html = renderToStaticMarkup(button);
  assert.match(html, /Retry/);
  assert.doesNotMatch(html, /class="[^"]*(?:group-hover|\bhidden\b)/);
});

test('forever mute is distinct from no record and timed mute expires', () => {
  assert.equal(status.isActiveMute(null), false);
  assert.equal(status.isActiveMute(undefined), false);
  assert.equal(status.isActiveMute({ muted_until: null }), true);
  assert.equal(status.isActiveMute({ muted_until: new Date(2000).toISOString() }, 1000), true);
  assert.equal(status.isActiveMute({ muted_until: new Date(1000).toISOString() }, 1000), false);
});

function table(initial = [], keyForRow = value => value.id || [value.conversation_id, value.user_id]) {
  const key = value => JSON.stringify(Array.isArray(value) ? value : keyForRow(value));
  const rows = new Map(initial.map(row => [key(row), structuredClone(row)]));
  const api = {
    rows,
    get: async id => structuredClone(rows.get(Array.isArray(id) ? JSON.stringify(id) : JSON.stringify(id))),
    put: async row => { rows.set(key(row), structuredClone(row)); },
    toArray: async () => structuredClone([...rows.values()]),
    delete: async id => { rows.delete(JSON.stringify(id)); },
    update: async (id, fields) => { const old = await api.get(id); if (old) await api.put({ ...old, ...fields }); },
    bulkPut: async list => { for (const row of list) await api.put(row); },
    bulkDelete: async ids => { for (const id of ids) await api.delete(id); },
    where: field => ({ equals: value => ({ toArray: async () => (await api.toArray()).filter(row => row[field] === value) }), anyOf: ids => ({
      toArray: async () => (await Promise.all(ids.map(api.get))).filter(Boolean),
      modify: async fields => { for (const id of ids) await api.update(id, fields); },
    }) }),
  };
  return api;
}
function database(messages = [], queue = []) {
  const db = { messages: table(messages), sync_queue: table(queue), read_receipts: table(), conversations_meta: table([], row => row.conversation_id), transactions: [] };
  db.transaction = async (...args) => {
    db.transactions.push(args.slice(0, -1));
    const snapshots = args.slice(1, -1).map(t => [t, new Map(t.rows)]);
    try { return await args.at(-1)(); }
    catch (err) { for (const [t, rows] of snapshots) { t.rows.clear(); for (const [k,v] of rows) t.rows.set(k,v); } throw err; }
  };
  return db;
}
const queueItem = (id = 'm1', type = 'message_insert', payload = { id, conversation_id: 'c1' }) => ({ id, type, payload, retry_count: 0, status: 'pending' });
function syncModule(db, upsert, online = true) {
  return load('src/lib/sync.ts', {
    './chatUnread': unread,
    './db': { chatDb: db, sanitizeMessage: data => data },
    '@/integrations/supabase/client': { supabase: { from: name => ({ upsert: (payload, options) => upsert(name, payload, options) }) } },
  }, { navigator: { onLine: online } });
}

test('offline sends remain queued without consuming retries or touching the server', async () => {
  const db = database([{ id: 'm1', sync_status: 'pending' }], [queueItem()]);
  await syncModule(db, () => { throw Error('Must not contact server'); }, false).processSyncQueue();
  assert.equal((await db.sync_queue.get('m1')).retry_count, 0);
  assert.equal((await db.messages.get('m1')).sync_status, 'pending');
});

test('concurrent queue wakeups use one writer and successful sends become sent, not delivered', async () => {
  const db = database([{ id: 'm1', sync_status: 'pending' }], [queueItem()]);
  let release;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let calls = 0;
  const sync = syncModule(db, async () => {
    calls++;
    assert.equal((await db.messages.get('m1')).sync_status, 'sending');
    started();
    await new Promise(resolve => { release = resolve; });
    return { error: null };
  });
  const first = sync.processSyncQueue();
  await ready;
  const second = sync.processSyncQueue();
  assert.equal(first, second);
  release();
  await first;
  assert.equal(calls, 1);
  assert.equal((await db.messages.get('m1')).sync_status, 'sent');
  assert.equal((await db.sync_queue.toArray()).length, 0);
});

test('a rejected send remains visible as failed and retains its payload for retry', async () => {
  const db = database([{ id: 'm1', content: 'Keep this', sync_status: 'pending' }], [queueItem()]);
  await syncModule(db, async () => ({ error: { code: '42501' } })).processSyncQueue();
  assert.equal((await db.messages.get('m1')).sync_status, 'failed');
  assert.equal((await db.messages.get('m1')).content, 'Keep this');
  assert.equal((await db.sync_queue.get('m1')).retry_count, 1);
});

test('an in-flight receipt cannot remove a newer queued receipt', async () => {
  const receipt = { conversation_id: 'c1', user_id: 'u1', last_read_seq: 10 };
  const db = database([], [queueItem('read1', 'read_receipt', receipt)]);
  const sync = syncModule(db, async () => {
    await db.sync_queue.put(queueItem('read1', 'read_receipt', { ...receipt, last_read_seq: 20 }));
    return { error: null };
  });
  await sync.processSyncQueue();
  assert.equal((await db.sync_queue.get('read1')).payload.last_read_seq, 20);
});

function messagesModule(db, extra = {}, globals = {}) {
  return load('src/hooks/useMessages.ts', {
    react: { ...React, useRef: value => ({ current: value }), useEffect() {} },
    '@tanstack/react-query': { useMutation: options => ({ ...options, mutate: options.mutationFn }), useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/integrations/supabase/client': { supabase: {} },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    'dexie-react-hooks': {}, '@/lib/db': { chatDb: db, sanitizeMessage: data => data },
    '@/lib/sync': { processSyncQueue: async () => {}, syncConversation: async () => {} },
    './useNotifications': { useNotifications: () => ({ markConversationNotificationsAsRead: { mutate() {} } }) },
    ...extra,
  }, globals);
}

test('send saves its message and outbox in one transaction before any network activity', async () => {
  const db = database();
  const hook = messagesModule(db).useSendMessage();
  await hook.sendMessage({ conversationId: 'c1', senderId: 'u1', content: 'Test', id: 'm1' });
  assert.equal((await db.messages.get('m1')).sync_status, 'pending');
  assert.equal((await db.sync_queue.get('m1')).payload.content, 'Test');
  assert.equal(db.transactions.length, 1);
  assert.ok(db.transactions[0].includes(db.messages) && db.transactions[0].includes(db.sync_queue));
});

test('outbox persistence failure does not leave an unsendable phantom message', async () => {
  const db = database();
  db.sync_queue.put = async () => { throw Error('Storage full'); };
  await assert.rejects(messagesModule(db).useSendMessage().sendMessage({ conversationId: 'c1', senderId: 'u1', content: 'Test', id: 'm1' }), /Storage full/);
  assert.equal(await db.messages.get('m1'), undefined);
});

test('read receipt waits for visibility and rechecks document focus before writing', async () => {
  for (const [canMarkRead, focused, expected] of [[false,true,0], [true,false,0], [true,true,1]]) {
    const db = database();
    const effects = [], timers = [];
    let query = 0;
    const hook = messagesModule(db, {
      react: { ...React, useState: value => [value, () => {}], useRef: value => ({ current: value }),
        useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn) },
      'dexie-react-hooks': { useLiveQuery: () => query++ === 0 ? [{ id: 'm1', seq: 10, sender_id: 'peer' }] : {} },
    }, { setTimeout: fn => { timers.push(fn); }, clearTimeout() {}, document: { visibilityState: 'visible', hasFocus: () => focused } });
    hook.useMessages('c1', 'u1', canMarkRead);
    // Last effect is the actual read-receipt loop; other effects handle network/profile subscriptions.
    effects.at(-1)();
    for (const timer of timers) await timer();
    assert.equal((await db.read_receipts.toArray()).length, expected);
    assert.equal((await db.sync_queue.toArray()).length, expected);
  }
});

test('rejected edits restore their previous local contents', async () => {
  const original = { id: 'm1', content: 'Original', is_edited: false, updated_at: 'before' };
  const db = database([original]);
  const builder = { update: () => builder, eq: () => builder, select: () => builder, single: async () => ({ error: Error('Rejected') }) };
  const hooks = load('src/hooks/useMessageActions.ts', {
    '@/lib/chatMedia': {},
    '@tanstack/react-query': { useMutation: options => options, useQueryClient: () => ({}) },
    '@/integrations/supabase/client': { supabase: { from: () => builder } },
    '@/lib/db': { chatDb: db }, 'dexie-react-hooks': {}, sonner: { toast: {} },
  });
  await assert.rejects(hooks.useEditMessage().mutationFn({ messageId: 'm1', content: 'Changed', conversationId: 'c1' }), /Rejected/);
  assert.deepEqual(await db.messages.get('m1'), original);
});

test('responsive page mounts only one chat and resets it when changing conversations', () => {
  const source = fs.readFileSync(path.join(root, 'src/pages/Messages.tsx'), 'utf8');
  assert.equal((source.match(/<ChatView\b/g) || []).length, 1);
  assert.match(source, /key=\{selectedConversation.conversation_id\}/);
});

test('chat-end observer requires full visibility and window focus and cleans up', () => {
  const effects = [], values = [], listeners = new Map();
  let intersect, disconnected = false, focused = true;
  const document = { visibilityState: 'visible', hasFocus: () => focused,
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const window = { addEventListener: document.addEventListener, removeEventListener: document.removeEventListener };
  const rootNode = {}, endNode = {};
  const hook = load('src/hooks/useVisibleChatEnd.ts', {
    react: { useState: () => [false, value => values.push(value)], useEffect: fn => effects.push(fn) },
  }, { document, window, IntersectionObserver: class {
    constructor(callback, options) { intersect = callback; assert.equal(options.root, rootNode); }
    observe(node) { assert.equal(node, endNode); }
    disconnect() { disconnected = true; }
  } });
  hook.useVisibleChatEnd({ current: rootNode }, { current: endNode }, 'c1');
  const cleanup = effects[0]();
  intersect([{ isIntersecting: true, intersectionRatio: 0.5 }]);
  assert.equal(values.at(-1), false);
  intersect([{ isIntersecting: true, intersectionRatio: 1 }]);
  assert.equal(values.at(-1), true);
  focused = false;
  listeners.get('blur')();
  assert.equal(values.at(-1), false);
  focused = true;
  document.visibilityState = 'hidden';
  listeners.get('visibilitychange')();
  assert.equal(values.at(-1), false);
  cleanup();
  assert.equal(disconnected, true);
  assert.equal(listeners.size, 0);
});

test('global listener cannot clear unread just because the route is open', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/GlobalRealtimeListener.tsx'), 'utf8');
  assert.doesNotMatch(source, /unread_count:\s*0/);
});

test('broadcast payloads are not inserted as trusted messages', () => {
  const source = fs.readFileSync(path.join(root, 'src/hooks/useMessages.ts'), 'utf8');
  assert.match(source, /\.on\('broadcast', \{ event: 'new_message' \}, debouncedSync\)/);
  assert.doesNotMatch(source, /broadcastRef|\.\.\.payload/);
});

test('unread counts ignore gaps, own messages, deletions and edits to already-read messages', () => {
  const messages = [
    { sender_id: 'peer', seq: 100, created_seq: 2 },
    { sender_id: 'peer', seq: 120, created_seq: 120 },
    { sender_id: 'self', seq: 121, created_seq: 121 },
    { sender_id: 'peer', seq: 150, deleted_for_everyone: true },
    { sender_id: 'peer', seq: 200 },
  ];
  assert.equal(unread.countUnreadMessages(messages, 'self', 50), 2);
  assert.equal(unread.countUnreadMessages(messages, 'self', 200), 0);
});

test('pending/newer local reads supersede stale cached counts; authoritative zero is not inflated by old cached rows', () => {
  assert.equal(unread.reconcileUnreadCount(1, 30, 15, 10, false), 1);
  assert.equal(unread.reconcileUnreadCount(1, 30, 15, undefined, true), 1);
  assert.equal(unread.reconcileUnreadCount(0, 3, 15, 15, false), 3);
  assert.equal(unread.reconcileUnreadCount(2, 0, 15, 15, false), 0);
  assert.equal(unread.reconcileUnreadCount(2, 0, 0, undefined, false), 2);
});

const cid = '11111111-1111-4111-8111-111111111111';
const uid = '22222222-2222-4222-8222-222222222222';
const dest = '33333333-3333-4333-8333-333333333333';
const privateRef = `chat-media://${cid}/${uid}/file.jpg`;
function mediaModule(handlers = {}) {
  const calls = [];
  const api = load('src/lib/chatMedia.ts', { '@/integrations/supabase/client': { supabase: {
    auth: { getUser: async () => handlers.auth || ({ data: { user: { id: uid } }, error: null }) },
    storage: { from: bucket => ({
      upload: async (path, file, options) => { calls.push({ type: 'upload', bucket, path, file, options }); return { error: handlers.uploadError || null }; },
      createSignedUrl: async (path, ttl) => { calls.push({ type: 'sign', bucket, path, ttl }); return handlers.signResult || { data: { signedUrl: 'https://storage.test/signed?token=ephemeral' }, error: null }; },
      download: async path => { calls.push({ type: 'download', bucket, path }); return { data: handlers.file || { type: 'image/jpeg' }, error: handlers.downloadError || null }; },
      getPublicUrl: path => ({ data: { publicUrl: `https://storage.test/storage/v1/object/public/${bucket}/${path}` } }),
    }) },
  } } }, { URL });
  return { ...api, calls };
}

test('private paths require conversation and uploader namespaces and reject traversal', () => {
  const media = mediaModule();
  assert.equal(media.privateChatPath(privateRef), `${cid}/${uid}/file.jpg`);
  assert.equal(media.privateChatPath('https://legacy.test/image.jpg'), null);
  for (const suffix of ['../file.jpg', '..', '.', '%2e%2e', 'file.jpg?token=secret']) {
    assert.throws(() => media.privateChatPath(`chat-media://${cid}/${uid}/${suffix}`));
  }
});

test('uploads persist a stable private reference rather than a public or signed URL', async () => {
  const media = mediaModule();
  const result = await media.uploadChatMedia(cid, {}, 'my photo.jpg');
  assert.equal(result, `chat-media://${cid}/${uid}/test-id-my_photo.jpg`);
  assert.equal(media.calls.length, 1);
  assert.equal(media.calls[0].bucket, 'chat-media');
  assert.equal(media.calls[0].options.upsert, false);
  assert.doesNotMatch(result, /https:|token=/);
});

test('failed private uploads do not fall back to a public bucket', async () => {
  const media = mediaModule({ uploadError: Error('Bucket missing') });
  await assert.rejects(media.uploadChatMedia(cid, {}, 'photo.jpg'), /Private upload unavailable/);
  assert.equal(media.calls.length, 1);
  assert.equal(media.calls[0].bucket, 'chat-media');
});

test('oversized attachments are rejected before uploading', async () => {
  const media = mediaModule();
  await assert.rejects(media.uploadChatMedia(cid, { size: 50 * 1024 * 1024 + 1 }, 'large.mp4'), /50 MB/);
  assert.equal(media.calls.length, 0);
});

test('signed attachment downloads have a five-minute lifetime and fail closed', async () => {
  const media = mediaModule();
  assert.match(await media.resolveChatMedia(privateRef), /token=ephemeral/);
  assert.equal(media.calls[0].ttl, 300);
  const rejected = mediaModule({ signResult: { data: null, error: Error('Denied') } });
  await assert.rejects(rejected.resolveChatMedia(privateRef), /unavailable/);
});

test('forwarding copies private data into the destination scope without forwarding a bearer token', async () => {
  const media = mediaModule();
  const result = await media.copyChatMediaToConversation(privateRef, dest);
  assert.match(result, new RegExp(`^chat-media://${dest}/${uid}/`));
  assert.equal(media.calls[0].type, 'download');
  assert.equal(media.calls[0].path, `${cid}/${uid}/file.jpg`);
  assert.equal(media.calls[1].type, 'upload');
  assert.equal(media.calls.some(call => call.type === 'sign'), false);
});

test('forwarding rejects inaccessible sources and arbitrary external files', async () => {
  const denied = mediaModule({ downloadError: Error('Denied') });
  await assert.rejects(denied.copyChatMediaToConversation(privateRef, dest), /Cannot access/);
  assert.equal(denied.calls.filter(call => call.type === 'upload').length, 0);
  const external = mediaModule();
  await assert.rejects(external.copyChatMediaToConversation('https://untrusted.test/secret.jpg', dest), /Reattach/);
  assert.equal(external.calls.length, 0);
});

test('legacy first-party public attachments are copied privately when forwarded', async () => {
  const media = mediaModule();
  const result = await media.copyChatMediaToConversation(`https://storage.test/storage/v1/object/public/post-media/${cid}/old.jpg`, dest);
  assert.equal(media.calls[0].bucket, 'post-media');
  assert.equal(media.calls[1].bucket, 'chat-media');
  assert.match(result, /^chat-media:\/\//);
});

test('all message upload entry points use the private helper', () => {
  for (const file of ['MediaPreviewModal', 'TelegramAttachmentSheet', 'VoiceRecorder', 'ChatAttachmentMenu']) {
    const source = fs.readFileSync(path.join(root, `src/components/messages/${file}.tsx`), 'utf8');
    assert.match(source, /uploadChatMedia/);
    assert.doesNotMatch(source, /getPublicUrl|from\('post-media'\)/);
  }
});

test('staged migrations constrain receipt and storage permissions without altering the public post bucket', () => {
  const source = fs.readFileSync(path.join(root, 'supabase/migrations/20260921090000_chat_privacy_and_receipts.sql'), 'utf8');
  assert.match(source, /VALUES \('chat-media', 'chat-media', false/);
  assert.match(source, /chat_media_read_guard[\s\S]*AS RESTRICTIVE/);
  assert.match(source, /GREATEST\(OLD.last_read_seq, NEW.last_read_seq\)/);
  assert.match(source, /NEW.created_seq := OLD.created_seq/);
  assert.doesNotMatch(source, /UPDATE storage\.buckets[\s\S]*post-media|DELETE FROM storage/);
  const guarded = fs.readFileSync(path.join(root, 'supabase/migrations/20260921091000_guard_conversation_list.sql'), 'utf8');
  assert.match(guarded, /_user_id IS DISTINCT FROM auth.uid\(\)/);
});

function listSyncModule(db, rpc) {
  return load('src/lib/sync.ts', {
    './chatUnread': unread, './db': { chatDb: db, sanitizeMessage: value => value },
    '@/integrations/supabase/client': { supabase: { rpc } },
  });
}

test('list sync no longer preserves zero unread forever, including when the latest message is our own', async () => {
  const db = database();
  await db.conversations_meta.put({ conversation_id: 'c1', unread_count: 0 });
  const sync = listSyncModule(db, async name => name === 'get_user_conversations'
    ? { data: [{ conversation_id: 'c1', unread_count: 2, last_message_sender_id: 'self' }], error: null }
    : { data: [{ conversation_id: 'c1', unread_count: 2, last_read_seq: 0, latest_seq: 50 }], error: null });
  await sync.syncConversations('self');
  assert.equal((await db.conversations_meta.get('c1')).unread_count, 2);
});

test('cross-device reads update local receipt positions and authoritative unread counts', async () => {
  const db = database();
  await db.read_receipts.put({ conversation_id: 'c1', user_id: 'self', last_read_seq: 10 });
  const sync = listSyncModule(db, async name => name === 'get_user_conversations'
    ? { data: [{ conversation_id: 'c1', unread_count: 6 }], error: null }
    : { data: [{ conversation_id: 'c1', unread_count: 0, last_read_seq: 50, latest_seq: 50 }], error: null });
  await sync.syncConversations('self');
  assert.equal((await db.read_receipts.get(['c1', 'self'])).last_read_seq, 50);
  assert.equal((await db.conversations_meta.get('c1')).unread_count, 0);
});

test('a local read advancing during the server request is not undone by a stale count', async () => {
  const db = database([{ id: 'new', conversation_id: 'c1', sender_id: 'peer', seq: 51 }]);
  const sync = listSyncModule(db, async name => {
    if (name === 'get_user_conversations') return { data: [{ conversation_id: 'c1', unread_count: 10 }], error: null };
    await db.read_receipts.put({ conversation_id: 'c1', user_id: 'self', last_read_seq: 50 });
    return { data: [{ conversation_id: 'c1', unread_count: 10, last_read_seq: 10, latest_seq: 51 }], error: null };
  });
  await sync.syncConversations('self');
  assert.equal((await db.conversations_meta.get('c1')).unread_count, 1);
  assert.equal((await db.read_receipts.get(['c1', 'self'])).last_read_seq, 50);
});

test('legacy backend fallback preserves pending reads without retaining arbitrary zero counts', async () => {
  const db = database([], [queueItem('read_c1_self', 'read_receipt', { last_read_seq: 50 })]);
  await db.read_receipts.put({ conversation_id: 'c1', user_id: 'self', last_read_seq: 50 });
  const sync = listSyncModule(db, async name => name === 'get_user_conversations'
    ? { data: [{ conversation_id: 'c1', unread_count: 10 }], error: null }
    : { data: null, error: { code: 'PGRST202' } });
  await sync.syncConversations('self');
  assert.equal((await db.conversations_meta.get('c1')).unread_count, 0);
  await db.sync_queue.delete('read_c1_self');
  await sync.syncConversations('self');
  assert.equal((await db.conversations_meta.get('c1')).unread_count, 10);
});

test('private URL state is account-scoped, expires, renews, and cleans up', async () => {
  const state = [], effects = [], timers = [], listeners = new Map();
  let cursor = 0, account = 'alice', now = 1000, calls = 0;
  const hooks = load('src/hooks/useChatMediaUrls.ts', {
    react: {
      useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
      useEffect: fn => effects.push(fn),
    },
    '@/contexts/UserContext': { useUser: () => ({ user: { id: account } }) },
    '@/lib/chatMedia': { CHAT_MEDIA_TTL: 300, resolveChatMedia: async () => `signed-url-${++calls}` },
  }, { Date: { now: () => now }, setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {},
    window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) } });
  const draw = () => { cursor = 0; return hooks.useChatMediaUrls([privateRef]); };
  assert.equal(draw().url(privateRef), '');
  const cleanup = effects[0]();
  await new Promise(setImmediate);
  assert.equal(draw().url(privateRef), 'signed-url-1');
  assert.equal(timers[0].delay, 240000);
  account = 'bob';
  assert.equal(draw().url(privateRef), '');
  account = 'alice';
  now = 301001;
  assert.equal(draw().url(privateRef), '');
  await timers[0].fn();
  assert.equal(draw().url(privateRef), 'signed-url-2');
  cleanup();
  assert.equal(listeners.size, 0);
});
