import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import {
  buildPostShareUrl,
  copyTextToClipboard,
  formatPostShareMessage,
  shareViaNativeSheet,
} from '../lib/postShare.ts';

const db = new PGlite();
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const author = id(1);
const friend = id(2);
const outsider = id(3);
const publicPost = id(10);
const missingStatsPost = id(11);
const friendsPost = id(12);
const privateCircle = id(20);
const privateCirclePost = id(21);

const q = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

async function login(user: string | null) {
  await db.exec('RESET ROLE');
  await q("SELECT set_config('request.jwt.claim.sub', $1, false)", [user || '']);
  await db.exec(`SET ROLE ${user ? 'authenticated' : 'anon'}`);
}

before(async () => {
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;

    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    CREATE TABLE public.circles (
      id uuid PRIMARY KEY,
      creator_id uuid NOT NULL,
      is_private boolean DEFAULT false
    );

    CREATE TABLE public.circle_members (
      circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      status text DEFAULT 'active'
    );

    CREATE TABLE public.follows (
      follower_id uuid NOT NULL,
      following_id uuid NOT NULL
    );

    CREATE TABLE public.posts (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL,
      circle_id uuid REFERENCES public.circles(id) ON DELETE CASCADE,
      visibility text DEFAULT 'public'
    );

    CREATE TABLE public.post_stats (
      post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
      likes_count integer DEFAULT 0,
      comments_count integer DEFAULT 0,
      shares_count integer DEFAULT 0,
      saves_count integer DEFAULT 0,
      updated_at timestamptz DEFAULT now()
    );

    ALTER TABLE public.post_stats ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Post stats are viewable by everyone"
      ON public.post_stats FOR SELECT USING (true);
    GRANT SELECT, UPDATE ON public.post_stats TO authenticated, anon;
  `);

  const migrationSql = await readFile(
    new URL('../../supabase/migrations/20261125180000_increment_post_shares_rpc.sql', import.meta.url),
    'utf8',
  );
  await db.exec(migrationSql);
});

beforeEach(async () => {
  await db.exec('RESET ROLE');
  await db.exec('TRUNCATE public.post_stats, public.posts, public.circle_members, public.circles, public.follows CASCADE');

  await q('INSERT INTO public.follows (follower_id, following_id) VALUES ($1, $2)', [friend, author]);
  await q('INSERT INTO public.circles (id, creator_id, is_private) VALUES ($1, $2, true)', [privateCircle, author]);
  await q("INSERT INTO public.circle_members (circle_id, user_id, status) VALUES ($1, $2, 'active')", [privateCircle, friend]);

  await q("INSERT INTO public.posts (id, user_id, visibility) VALUES ($1, $2, 'public')", [publicPost, author]);
  await q('INSERT INTO public.post_stats (post_id, shares_count) VALUES ($1, 0)', [publicPost]);

  await q("INSERT INTO public.posts (id, user_id, visibility) VALUES ($1, $2, 'public')", [missingStatsPost, author]);
  await q("INSERT INTO public.posts (id, user_id, visibility) VALUES ($1, $2, 'friends')", [friendsPost, author]);
  await q('INSERT INTO public.post_stats (post_id, shares_count) VALUES ($1, 0)', [friendsPost]);

  await q("INSERT INTO public.posts (id, user_id, circle_id, visibility) VALUES ($1, $2, $3, 'public')", [
    privateCirclePost,
    author,
    privateCircle,
  ]);
  await q('INSERT INTO public.post_stats (post_id, shares_count) VALUES ($1, 0)', [privateCirclePost]);
});

after(async () => {
  await db.close();
});

test('share URLs and messages format feed and circle posts properly', () => {
  assert.equal(buildPostShareUrl('p-1', 'https://serkle.app/'), 'https://serkle.app/post/p-1');
  assert.equal(buildPostShareUrl('p-1', 'https://serkle.app', 'c-9'), 'https://serkle.app/circle/c-9/post/p-1');
  assert.equal(
    formatPostShareMessage('https://serkle.app/post/p-1', 'Hana'),
    "Check out Hana's post on Serkle: https://serkle.app/post/p-1",
  );
  assert.equal(
    formatPostShareMessage('https://serkle.app/post/p-1', ''),
    'Check out this post on Serkle: https://serkle.app/post/p-1',
  );
});

test('copy and native share helpers only confirm actual completed shares', async () => {
  let copied = '';
  assert.equal(
    await copyTextToClipboard('https://serkle.app/post/1', {
      writeText: async (value) => { copied = value; },
    }),
    true,
  );
  assert.equal(copied, 'https://serkle.app/post/1');

  assert.equal(
    await copyTextToClipboard('https://serkle.app/post/1', {
      writeText: async () => { throw new Error('denied'); },
    }, undefined),
    false,
  );

  assert.equal(await shareViaNativeSheet({ url: 'https://serkle.app/post/1' }, undefined), 'unsupported');
  assert.equal(
    await shareViaNativeSheet({ url: 'https://serkle.app/post/1' }, async () => {
      const err = new Error('User cancelled');
      err.name = 'AbortError';
      throw err;
    }),
    'cancelled',
  );
  assert.equal(
    await shareViaNativeSheet({ url: 'https://serkle.app/post/1' }, async () => undefined),
    'shared',
  );
});

test('increment_post_shares persists counts despite post_stats RLS and enforces post visibility', async () => {
  await login(outsider);

  // Direct client UPDATE on post_stats is blocked by RLS (the original persistence bug).
  const direct = await q('UPDATE public.post_stats SET shares_count = 99 WHERE post_id = $1 RETURNING shares_count', [publicPost]);
  assert.equal(direct.length, 0);

  // Confirmed shares via RPC persist atomically across reads.
  assert.equal((await q('SELECT public.increment_post_shares($1) count', [publicPost]))[0].count, 1);
  assert.equal((await q('SELECT public.increment_post_shares($1) count', [publicPost]))[0].count, 2);
  assert.equal((await q('SELECT shares_count FROM public.post_stats WHERE post_id = $1', [publicPost]))[0].shares_count, 2);

  // Missing post_stats row is created cleanly on first share.
  assert.equal((await q('SELECT public.increment_post_shares($1) count', [missingStatsPost]))[0].count, 1);

  // Outsiders cannot increment shares on friends-only or private circle posts.
  assert.equal((await q('SELECT public.increment_post_shares($1) count', [friendsPost]))[0].count, null);
  assert.equal((await q('SELECT public.increment_post_shares($1) count', [privateCirclePost]))[0].count, null);
  assert.equal((await q('SELECT shares_count FROM public.post_stats WHERE post_id = $1', [friendsPost]))[0].shares_count, 0);
  assert.equal((await q('SELECT shares_count FROM public.post_stats WHERE post_id = $1', [privateCirclePost]))[0].shares_count, 0);

  // Authorized friend / circle member can persist shares on those posts.
  await login(friend);
  assert.equal((await q('SELECT public.increment_post_shares($1) count', [friendsPost]))[0].count, 1);
  assert.equal((await q('SELECT public.increment_post_shares($1) count', [privateCirclePost]))[0].count, 1);
});
