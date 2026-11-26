import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import {
  buildVideoShareUrl,
  copyTextToClipboard,
  formatVideoShareMessage,
  shareViaNativeSheet,
} from '../lib/videoShare.ts';

const db = new PGlite();
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const creator = id(1);
const viewerA = id(2);
const viewerB = id(3);
const videoWithStats = id(10);
const videoMissingStats = id(11);
const videoDriftedStats = id(12);
const missingVideo = id(99);

const q = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

async function login(user: string | null) {
  await db.exec('RESET ROLE');
  await q("SELECT set_config('request.jwt.claim.sub', $1, false)", [user || '']);
  await db.exec(`SET ROLE ${user ? 'authenticated' : 'anon'}`);
}

let migrationSql = '';

before(async () => {
  migrationSql = await readFile(
    new URL('../../supabase/migrations/20261126104500_relax_video_save_share_persistence.sql', import.meta.url),
    'utf8',
  );

  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;

    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY,
      username text NOT NULL,
      name text NOT NULL,
      initials text NOT NULL,
      avatar_url text,
      avatar_color text NOT NULL,
      is_verified boolean DEFAULT false
    );

    CREATE TABLE public.videos (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      video_url text NOT NULL,
      thumbnail_url text,
      title text NOT NULL,
      description text,
      tags text[] DEFAULT '{}',
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE public.video_stats (
      video_id uuid PRIMARY KEY REFERENCES public.videos(id) ON DELETE CASCADE,
      likes_count integer DEFAULT 0,
      comments_count integer DEFAULT 0,
      shares_count integer DEFAULT 0,
      saves_count integer DEFAULT 0,
      views_count integer DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE public.video_likes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      UNIQUE(video_id, user_id)
    );

    CREATE TABLE public.video_saves (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      UNIQUE(video_id, user_id)
    );

    ALTER TABLE public.video_stats ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Video stats are viewable by everyone"
      ON public.video_stats FOR SELECT USING (true);
    GRANT SELECT, UPDATE ON public.video_stats TO authenticated, anon;

    ALTER TABLE public.video_saves ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view own video saves"
      ON public.video_saves FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Users can save videos"
      ON public.video_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can unsave videos"
      ON public.video_saves FOR DELETE USING (auth.uid() = user_id);
    GRANT SELECT, INSERT, DELETE ON public.video_saves TO authenticated;
    GRANT SELECT ON public.video_saves TO anon;
    GRANT SELECT ON public.videos, public.profiles, public.video_likes TO authenticated, anon;
  `);

  // Seed pre-migration drifted and missing stats to verify migration backfill & reconciliation.
  await q(
    `INSERT INTO public.profiles (id, username, name, initials, avatar_color)
     VALUES ($1, 'creator', 'Creator', 'CR', '#111111'),
            ($2, 'viewera', 'Viewer A', 'VA', '#222222'),
            ($3, 'viewerb', 'Viewer B', 'VB', '#333333')`,
    [creator, viewerA, viewerB],
  );
  await q(
    `INSERT INTO public.videos (id, user_id, video_url, title, description)
     VALUES ($1, $4, 'https://cdn.example/1.mp4', 'Video 1', 'Desc 1'),
            ($2, $4, 'https://cdn.example/2.mp4', 'Video 2', 'Desc 2'),
            ($3, $4, 'https://cdn.example/3.mp4', 'Video 3', 'Desc 3')`,
    [videoWithStats, videoMissingStats, videoDriftedStats, creator],
  );
  await q(
    `INSERT INTO public.video_stats (video_id, shares_count, saves_count)
     VALUES ($1, 0, 0), ($2, NULL, 99)`,
    [videoWithStats, videoDriftedStats],
  );
  await q(
    `INSERT INTO public.video_saves (video_id, user_id) VALUES ($1, $2)`,
    [videoDriftedStats, viewerA],
  );

  await db.exec(migrationSql);
});

beforeEach(async () => {
  await db.exec('RESET ROLE');
});

after(async () => {
  await db.close();
});

test('video share helpers build URLs, messages, and only confirm real share activities', async () => {
  assert.equal(buildVideoShareUrl('vid-1', 'https://serkle.app/'), 'https://serkle.app/video/vid-1');
  assert.equal(
    formatVideoShareMessage('https://serkle.app/video/vid-1', 'Sunset vibes'),
    'Check out "Sunset vibes" on Serkle: https://serkle.app/video/vid-1',
  );
  assert.equal(
    formatVideoShareMessage('https://serkle.app/video/vid-1', ''),
    'Check out this video! https://serkle.app/video/vid-1',
  );

  let copied = '';
  assert.equal(
    await copyTextToClipboard('https://serkle.app/video/vid-1', {
      writeText: async (v) => { copied = v; },
    }),
    true,
  );
  assert.equal(copied, 'https://serkle.app/video/vid-1');

  assert.equal(
    await copyTextToClipboard('https://serkle.app/video/vid-1', {
      writeText: async () => { throw new Error('denied'); },
    }, undefined),
    false,
  );

  assert.equal(
    await shareViaNativeSheet({ url: 'https://serkle.app/video/vid-1' }, async () => {
      const err = new Error('Cancelled');
      err.name = 'AbortError';
      throw err;
    }),
    'cancelled',
  );
  assert.equal(
    await shareViaNativeSheet({ url: 'https://serkle.app/video/vid-1' }, async () => undefined),
    'shared',
  );
});

test('migration backfills missing video_stats rows and reconciles drifted saves_count', async () => {
  const rows = await q(
    'SELECT video_id, shares_count, saves_count FROM public.video_stats ORDER BY video_id',
  );
  assert.equal(rows.length, 3);
  const byId = Object.fromEntries(rows.map((r: any) => [r.video_id, r]));
  assert.equal(byId[videoMissingStats].saves_count, 0);
  assert.equal(byId[videoMissingStats].shares_count, 0);
  assert.equal(byId[videoDriftedStats].saves_count, 1);
  assert.equal(byId[videoDriftedStats].shares_count, 0);
});

test('increment_relax_video_shares persists shares despite video_stats RLS', async () => {
  // Remove stats row for videoMissingStats to verify upsert works on first share too.
  await q('DELETE FROM public.video_stats WHERE video_id = $1', [videoMissingStats]);

  await login(viewerA);

  // Direct client UPDATE on video_stats is silently blocked by RLS (original Relax bug).
  const direct = await q(
    'UPDATE public.video_stats SET shares_count = 42 WHERE video_id = $1 RETURNING shares_count',
    [videoWithStats],
  );
  assert.equal(direct.length, 0);

  // Confirmed share activities persist atomically via RPC.
  assert.equal((await q('SELECT public.increment_relax_video_shares($1) count', [videoWithStats]))[0].count, 1);
  assert.equal((await q('SELECT public.increment_relax_video_shares($1) count', [videoWithStats]))[0].count, 2);
  assert.equal((await q('SELECT shares_count FROM public.video_stats WHERE video_id = $1', [videoWithStats]))[0].shares_count, 2);

  // Missing video_stats row is created on first share.
  assert.equal((await q('SELECT public.increment_relax_video_shares($1) count', [videoMissingStats]))[0].count, 1);

  // Unknown or NULL video ID returns NULL and does not create orphan stats.
  assert.equal((await q('SELECT public.increment_relax_video_shares($1) count', [missingVideo]))[0].count, null);
  assert.equal((await q('SELECT public.increment_relax_video_shares(NULL) count'))[0].count, null);

  // Anonymous viewers who complete a share activity (e.g. copy link) also persist shares.
  await login(null);
  assert.equal((await q('SELECT public.increment_relax_video_shares($1) count', [videoWithStats]))[0].count, 3);
});

test('video_saves persists save/unsave state and updates saves_count accurately across refreshes', async () => {
  await q('DELETE FROM public.video_saves WHERE video_id = $1', [videoWithStats]);
  await q('DELETE FROM public.video_stats WHERE video_id = $1', [videoMissingStats]);

  // Viewer A saves videoWithStats and videoMissingStats (even without pre-existing stats row).
  await login(viewerA);
  await q('INSERT INTO public.video_saves (video_id, user_id) VALUES ($1, $2)', [videoWithStats, viewerA]);
  await q('INSERT INTO public.video_saves (video_id, user_id) VALUES ($1, $2)', [videoMissingStats, viewerA]);

  assert.equal((await q('SELECT saves_count FROM public.video_stats WHERE video_id = $1', [videoWithStats]))[0].saves_count, 1);
  assert.equal((await q('SELECT saves_count FROM public.video_stats WHERE video_id = $1', [videoMissingStats]))[0].saves_count, 1);

  // Viewer A cannot insert a save impersonating Viewer B under RLS.
  await assert.rejects(
    q('INSERT INTO public.video_saves (video_id, user_id) VALUES ($1, $2)', [videoWithStats, viewerB]),
  );

  // Viewer B also saves videoWithStats -> count reaches 2.
  await login(viewerB);
  await q('INSERT INTO public.video_saves (video_id, user_id) VALUES ($1, $2)', [videoWithStats, viewerB]);
  assert.equal((await q('SELECT saves_count FROM public.video_stats WHERE video_id = $1', [videoWithStats]))[0].saves_count, 2);

  // get_video_feed reflects persisted saves_count, shares_count, and user_has_saved for each user.
  const feedForB = await q('SELECT video_id, saves_count, shares_count, user_has_saved FROM public.get_video_feed(0, 10)');
  const byIdForB = Object.fromEntries(feedForB.map((r: any) => [r.video_id, r]));
  assert.equal(byIdForB[videoWithStats].saves_count, 2);
  assert.equal(byIdForB[videoWithStats].user_has_saved, true);
  assert.equal(byIdForB[videoMissingStats].saves_count, 1);
  assert.equal(byIdForB[videoMissingStats].user_has_saved, false);

  // Viewer A unsaves videoWithStats -> count drops to 1 and user_has_saved flips to false for Viewer A.
  await login(viewerA);
  await q('DELETE FROM public.video_saves WHERE video_id = $1 AND user_id = $2', [videoWithStats, viewerA]);
  const feedForA = await q('SELECT video_id, saves_count, user_has_saved FROM public.get_video_feed(0, 10)');
  const byIdForA = Object.fromEntries(feedForA.map((r: any) => [r.video_id, r]));
  assert.equal(byIdForA[videoWithStats].saves_count, 1);
  assert.equal(byIdForA[videoWithStats].user_has_saved, false);
  assert.equal(byIdForA[videoMissingStats].saves_count, 1);
  assert.equal(byIdForA[videoMissingStats].user_has_saved, true);

  // Viewer B unsaves videoWithStats -> count drops cleanly to 0 and never goes negative.
  await login(viewerB);
  await q('DELETE FROM public.video_saves WHERE video_id = $1 AND user_id = $2', [videoWithStats, viewerB]);
  assert.equal((await q('SELECT saves_count FROM public.video_stats WHERE video_id = $1', [videoWithStats]))[0].saves_count, 0);
});
