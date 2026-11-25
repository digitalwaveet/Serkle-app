import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient } from '@tanstack/react-query';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let rpcCalls: Array<{ fn: string; params: any }> = [];
let rpcHandler: (fn: string, params: any) => Promise<{ data: any; error: any }> = async () => ({
  data: null,
  error: null,
});

before(async () => {
  server = await createServer({
    configFile: false,
    resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: [
      {
        name: 'isolated-circle-unlock-flow',
        enforce: 'pre',
        resolveId(source) {
          if (source.replaceAll('\\', '/').match(/(?:@|\/src)\/integrations\/supabase\/client(?:\.ts)?$/)) {
            return '\0isolated-supabase-unlock';
          }
        },
        load(id) {
          if (id === '\0isolated-supabase-unlock') {
            return `
              export const __setRpc = (fn) => { globalThis.__circleTestRpc = fn; };
              export const supabase = {
                auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
                rpc: (fn, params) => globalThis.__circleTestRpc(fn, params),
              };
            `;
          }
        },
      },
    ],
  });
});

after(async () => {
  await server?.close();
});

test('Circle preview uses the supplied image with no blur, crop, or unlock overlay', async () => {
  const { CirclePreviewImage } = await server.ssrLoadModule('/src/components/circles/CirclePostPreview.tsx');
  const src = 'data:image/webp;base64,AAAA';
  const html = renderToStaticMarkup(React.createElement(CirclePreviewImage, { src }));
  assert.ok(html.includes(src));
  assert.ok(html.includes('object-contain'));
  assert.doesNotMatch(html, /blur|scale-|Unlock/);
});

test('the headline field displays its enforced limit and unchanged headlines are omitted from edits', async () => {
  const { CircleHeadlineField } = await server.ssrLoadModule('/src/components/circles/CircleHeadlineField.tsx');
  const { circleHeadlineChange, isMissingCircleHeadlineColumn } = await server.ssrLoadModule('/src/lib/circlePostPreview.ts');
  const html = renderToStaticMarkup(React.createElement(CircleHeadlineField, { value: 'A hook', onChange: () => {} }));
  assert.match(html, /maxLength="120"/i);
  assert.match(html, /6\/120 characters/);
  assert.match(html, /aria-describedby="[^"]+-length"/);
  assert.deepEqual(circleHeadlineChange(' ', null), {});
  assert.deepEqual(circleHeadlineChange('A hook', 'A hook'), {});
  assert.deepEqual(circleHeadlineChange(' A hook ', null), { circle_headline: 'A hook' });
  assert.deepEqual(circleHeadlineChange('', 'A hook'), { circle_headline: null });
  assert.equal(isMissingCircleHeadlineColumn({ code: 'PGRST204', message: 'Missing circle_headline' }), true);
  assert.equal(isMissingCircleHeadlineColumn({ code: 'PGRST204', message: 'Missing another column' }), false);
});

test('a missing v2 preview function falls back to the clear legacy cover and hides the excerpt in feeds', async () => {
  const { getCirclePostPreviews } = await server.ssrLoadModule('/src/lib/circlePostPreview.ts');
  const cover = 'data:image/webp;base64,AAAA';
  (globalThis as any).__circleTestRpc = async (fn: string, params: any) => {
    if (fn === 'get_circle_post_previews_v2') return { data: null, error: { code: 'PGRST202' } };
    assert.equal(fn, 'get_circle_post_previews');
    assert.equal(params._detail, true);
    return { data: [{ post_id: 'post-1', preview_image: cover, preview_text: 'Teaser', has_tips_enabled: false }], error: null };
  };
  const [feed] = await getCirclePostPreviews('circle-1', ['post-1']);
  assert.equal(feed.headline, null);
  assert.equal(feed.preview_image, cover);
  assert.equal(feed.preview_text, null);
  const [detail] = await getCirclePostPreviews('circle-1', ['post-1'], true);
  assert.equal(detail.preview_text, 'Teaser');
});

test('confirmCirclePostAccess retries brief lag and confirms unlocked state without failing', async () => {
  const { confirmCirclePostAccess } = await server.ssrLoadModule('/src/lib/circlePayments.ts');
  let attempts = 0;
  (globalThis as any).__circleTestRpc = async (fn: string, params: any) => {
    rpcCalls.push({ fn, params });
    attempts += 1;
    if (attempts === 1) return { data: null, error: { message: 'transient' } };
    if (attempts === 2) return { data: [{ post_id: 'post-1', user_has_unlocked: false }], error: null };
    return { data: [{ post_id: 'post-1', user_has_unlocked: true, content: 'Unlocked body' }], error: null };
  };

  rpcCalls = [];
  const result = await confirmCirclePostAccess('post-1', [0, 1, 1, 1]);
  assert.equal(result.confirmed, true);
  assert.equal(result.row?.content, 'Unlocked body');
  assert.equal(rpcCalls.length, 3);
});

test('refreshCircleAccessQueries refetches active subscription and post queries immediately', async () => {
  const { refreshCircleAccessQueries } = await server.ssrLoadModule('/src/lib/circlePayments.ts');
  const queryClient = new QueryClient();
  let postsFetched = 0;
  let subFetched = 0;
  let postDetailFetched = 0;

  const u1 = queryClient.getQueryCache().build(queryClient, {
    queryKey: ['circle-posts', 'circle-1', 'user-1'],
    queryFn: async () => (++postsFetched, [{ id: 'p1', user_has_unlocked: true }]),
  });
  const u2 = queryClient.getQueryCache().build(queryClient, {
    queryKey: ['circle-subscription', 'circle-1', 'user-1'],
    queryFn: async () => (++subFetched, { status: 'active' }),
  });
  const u3 = queryClient.getQueryCache().build(queryClient, {
    queryKey: ['circle-post', 'post-1', 'user-1', 'circle-1'],
    queryFn: async () => (++postDetailFetched, { post_id: 'post-1', user_has_unlocked: true }),
  });

  // Subscribe observers so queries count as active
  const o1 = queryClient.getQueryCache().find({ queryKey: u1.queryKey });
  const unsubs = [o1, u2, u3].map((q) => {
    const obs = { onQueryUpdate: () => {}, setOptions: () => {}, options: { queryKey: q!.queryKey } };
    q!.addObserver(obs as any);
    return () => q!.removeObserver(obs as any);
  });

  try {
    await refreshCircleAccessQueries(queryClient, { circleId: 'circle-1', postId: 'post-1' });
    assert.ok(postsFetched >= 1, 'circle-posts active query should refetch');
    assert.ok(subFetched >= 1, 'circle-subscription active query should refetch');
    assert.ok(postDetailFetched >= 1, 'circle-post active query should refetch');
  } finally {
    unsubs.forEach((fn) => fn());
    queryClient.clear();
  }
});

