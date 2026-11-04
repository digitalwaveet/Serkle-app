const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
function load(file, overrides = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, Blob, URL, crypto, fetch, console, AbortController, setTimeout, clearTimeout,
    require: id => overrides[id] || require(id) });
  return module.exports;
}
const media = load('src/lib/storyMedia.ts');
const jpeg = () => new Blob(['test-photo'], { type: 'image/jpeg' });
test('story files reject empty, unsupported and oversized payloads', () => {
  assert.throws(() => media.validateStoryFile(new Blob([], { type: 'image/jpeg' })), /empty/);
  assert.throws(() => media.validateStoryFile(new Blob(['svg'], { type: 'image/svg+xml' })), /Choose/);
  assert.throws(() => media.validateStoryFile({ size: 16 * 1024 * 1024, type: 'image/jpeg' }), /15 MB/);
  assert.throws(() => media.validateStoryFile({ size: 51 * 1024 * 1024, type: 'video/mp4' }), /50 MB/);
});
test('image and video formats retain the correct MIME-derived extensions', () => {
  assert.equal(media.validateStoryFile(jpeg()), 'image');
  assert.equal(media.validateStoryFile(new Blob(['video'], { type: 'video/webm' })), 'video');
  assert.equal(media.storyFileExtension(new Blob(['png'], { type: 'image/png' })), 'png');
  assert.equal(media.storyFileExtension(new Blob(['video'], { type: 'video/webm' })), 'webm');
});
test('relative dates safely handle missing, invalid and future timestamps', () => {
  assert.equal(media.storyRelativeTime('not-a-date'), 'Just now');
  assert.equal(media.storyRelativeTime(), 'Just now');
  assert.equal(media.storyRelativeTime(new Date(Date.now() + 300000).toISOString()), 'Just now');
});

function publisher({ existing = null, failUpload = 0, dbError = null, mentionError = null } = {}) {
  const calls = { uploads: [], removals: [], records: [], mentions: [] };
  const supabase = {
    storage: { from: () => ({
      upload: async (path, blob, options) => { calls.uploads.push({ path, blob, options }); return { error: calls.uploads.length === failUpload ? new Error('upload failed') : null }; },
      getPublicUrl: path => ({ data: { publicUrl: 'https://storage.example/' + path } }),
      remove: async paths => { calls.removals.push(paths); return { error: null }; },
    }) },
    from: table => {
      if (table === 'story_mentions') return { insert: async records => { calls.mentions.push(...records); return { error: mentionError }; } };
      let inserting = false;
      const builder = {
        select: () => builder, eq: () => builder,
        maybeSingle: async () => ({ data: existing, error: null }),
        insert: record => { inserting = true; calls.records.push(record); return builder; },
        single: async () => ({ data: inserting ? { id: calls.records.at(-1).id } : null, error: dbError }),
      };
      return builder;
    },
  };
  return { calls, publish: load('src/services/storyPublishing.ts', { '@/integrations/supabase/client': { supabase }, '@/lib/storyMedia': media }).publishStory };
}
function extras() { return { publicationId: 'test-publication', mediaType: 'image', story_state: {
  background: { type: 'image', value: 'blob:original' }, drawingPaths: [],
  elements: [{ id: 'sticker', type: 'image', file: jpeg(), content: 'blob:sticker', x: 50, y: 50, scale: 1, rotation: 0, zIndex: 1 }],
} }; }
test('publishing persists media and layers without mutating the draft', async () => {
  const { calls, publish } = publisher();
  const draft = extras();
  const result = await publish('owner', jpeg(), false, ['friend', 'friend'], draft);
  assert.equal(result.id, 'test-publication');
  assert.equal(calls.uploads.length, 2);
  assert.equal(draft.story_state.background.value, 'blob:original');
  assert.ok(draft.story_state.elements[0].file);
  const saved = calls.records[0].sticker_data[0].data;
  assert.match(saved.background.value, /^https:/);
  assert.match(saved.elements[0].content, /^https:/);
  assert.equal(saved.elements[0].file, undefined);
  assert.equal(calls.mentions.length, 1);
  assert.equal(calls.uploads[0].options.contentType, 'image/jpeg');
});
test('retry of a committed publication does not upload or insert it twice', async () => {
  const { calls, publish } = publisher({ existing: { id: 'test-publication' } });
  await publish('owner', jpeg(), false, [], extras());
  assert.equal(calls.uploads.length, 0); assert.equal(calls.records.length, 0);
});
test('failed sticker upload cleans up only newly uploaded media and preserves the draft', async () => {
  const { calls, publish } = publisher({ failUpload: 2 });
  const draft = extras();
  await assert.rejects(publish('owner', jpeg(), false, [], draft), /upload failed/);
  assert.equal(calls.removals[0].length, 1); assert.equal(calls.records.length, 0);
  assert.ok(draft.story_state.elements[0].file);
});
test('uncertain database insert never deletes potentially committed media', async () => {
  const { calls, publish } = publisher({ dbError: new Error('response lost') });
  await assert.rejects(publish('owner', jpeg(), false, [], extras()), /response lost/);
  assert.equal(calls.removals.length, 0);
});
test('mention failure reports partial success instead of duplicating a published story', async () => {
  const { publish } = publisher({ mentionError: new Error('mentions unavailable') });
  const result = await publish('owner', jpeg(), false, ['friend'], extras());
  assert.equal(result.mentionsSaved, false); assert.equal(result.id, 'test-publication');
});
test('mismatched video payload and unavailable blob stickers are rejected', async () => {
  const { calls, publish } = publisher();
  await assert.rejects(publish('owner', jpeg(), true, [], extras()), /does not match/);
  assert.equal(calls.uploads.length, 0);
  const draft = extras(); delete draft.story_state.elements[0].file;
  await assert.rejects(publish('owner', jpeg(), false, [], draft), /no longer available/);
  assert.equal(calls.records.length, 0);
});

function analytics({ errorTable, ownerId = 'owner' } = {}) {
  let options;
  const queries = [];
  const supabase = { from: table => {
    const query = { table, filters: [] }; queries.push(query);
    const builder = new Proxy({}, { get: (_, method) => {
      if (method === 'then') return (resolve, reject) => Promise.resolve(result()).then(resolve, reject);
      if (method === 'single') return async () => ({ data: { user_id: ownerId }, error: null });
      return (...args) => { if (method === 'select') { query.select = args[0]; query.head = args[1]?.head; } query.filters.push([method, ...args]); return builder; };
    } });
    function result() {
      if (table === errorTable) return { data: null, error: new Error('query denied'), count: null };
      if (table === 'story_views') return { data: [{ id: 'v', viewer_id: 'friend', viewed_at: '', profiles: { name: 'Friend' } }], count: 2345, error: null };
      if (table === 'story_likes') return { data: query.head ? null : [{ user_id: 'friend' }], count: 900, error: null };
      return { data: query.head ? null : [], count: 300, error: null };
    }
    return builder;
  } };
  const React = { useState: () => [50, () => {}], useEffect: () => {} };
  load('src/hooks/useStoryActivity.ts', { react: React, '@/integrations/supabase/client': { supabase }, '@/contexts/UserContext': { useUser: () => ({ user: { id: 'owner' } }) },
    '@tanstack/react-query': { useQueryClient: () => ({}), useQuery: value => { options = value; return {}; } },
  }).useStoryActivity('story-id');
  return { queries, execute: () => options.queryFn({ signal: new AbortController().signal }) };
}
test('analytics uses exact server counts, not the loaded page length', async () => {
  const { execute, queries } = analytics();
  const result = await execute();
  assert.equal(result.viewsCount, 2345); assert.equal(result.viewers.length, 1);
  assert.equal(result.likesCount, 900); assert.equal(result.repliesCount, 300);
  assert.equal(result.viewers[0].hasLiked, true);
  assert.ok(queries.find(q => q.table === 'story_messages' && q.head).filters.some(f => f[0] === 'neq' && f[1] === 'sender_id' && f[2] === 'owner'));
});
test('analytics query errors are not silently converted into zero metrics', async () => {
  await assert.rejects(analytics({ errorTable: 'story_views' }).execute(), /query denied/);
  await assert.rejects(analytics({ errorTable: 'story_messages' }).execute(), /query denied/);
});
test('analytics requires story ownership before reading viewers or messages', async () => {
  const { execute, queries } = analytics({ ownerId: 'someone-else' });
  await assert.rejects(execute(), /Only the story owner/);
  assert.equal(queries.length, 1);
});
test('story grid markup and behavior file has not changed', () => {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'src/components/StoriesBar.tsx'))).digest('hex').toUpperCase(), 'C414203C47D2BE6F35DE0887B63ACDFE0DC61306B5B2E7BA1FB31BB4DF0BCA11');
});
test('story sources parse successfully without TSX syntax diagnostics', () => {
  const files = ['src/components/StoryViewer.tsx', 'src/components/CreateStoryModal.tsx', 'src/components/StoryActivityModal.tsx',
    ...fs.readdirSync(path.join(root, 'src/components/story')).filter(f => f.endsWith('.tsx')).map(f => 'src/components/story/' + f)];
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(source.parseDiagnostics.length, 0, file);
  }
});
