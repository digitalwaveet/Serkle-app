import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { parseAdminSnapshot } from '../lib/adminSnapshot.ts';

const db = new PGlite();
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [admin, superAdmin, moderator, member] = [1, 2, 3, 4].map(id);
const [postId, reviewId, missingReviewId, otherReviewId, rollbackReviewId] = [10, 11, 12, 13, 14].map(id);
const migration = (file: string) => readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');

async function asUser(user: string | null, dbRole = 'authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
  await db.exec(dbRole === 'anon' ? 'SET ROLE anon' : 'SET ROLE authenticated');
}

async function snapshot() {
  const { rows } = await db.query<{ result: unknown }>('SELECT public.get_admin_operational_snapshot() AS result');
  return rows[0].result;
}

const resolve = (item: string, action: string, notes?: string) => db.query(
  'SELECT public.resolve_admin_content_review($1, $2, $3)', [item, action, notes ?? null],
);

before(async () => {
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE public.profiles (created_at timestamptz, banned_at timestamptz);
    CREATE TABLE public.posts (id uuid PRIMARY KEY, moderation_status text NOT NULL DEFAULT 'active');
    CREATE TABLE public.messages (id integer);
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.messages TO authenticated;
  `);
  for (const table of ['videos', 'stories', 'comments', 'circles', 'questions', 'orders']) {
    await db.exec(`CREATE TABLE public.${table} (id integer)`);
  }
  for (const table of ['sos_alerts', 'content_reports', 'live_streams', 'appeals', 'disputes']) {
    await db.exec(`CREATE TABLE public.${table} (status text)`);
  }
  const roles = await migration('20260308175212_c4d8482b-60d0-48d4-b7d3-a8e4f1ab76ba.sql');
  await db.exec(roles.slice(0, roles.indexOf('-- 7.')));
  const queue = await migration('20260308182601_a851a824-5ced-4e28-975e-86039b95a3ed.sql');
  await db.exec(queue.slice(queue.indexOf('-- Content review queue table')));
  await db.exec(await migration('20261127120000_admin_operations.sql'));
  await db.exec(`
    GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
    GRANT SELECT ON public.user_roles TO authenticated;
    INSERT INTO auth.users VALUES ('${admin}'), ('${superAdmin}'), ('${moderator}'), ('${member}');
    INSERT INTO public.user_roles (user_id, role) VALUES
      ('${admin}', 'admin'), ('${superAdmin}', 'super_admin'), ('${moderator}', 'moderator');
    SET time zone 'Africa/Nairobi';
    INSERT INTO public.profiles VALUES (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC', NULL),
      ((date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 second') AT TIME ZONE 'UTC', now()),
      (now() - interval '8 days', NULL);
    INSERT INTO public.messages VALUES (1), (2);
    INSERT INTO public.sos_alerts VALUES ('active'), ('responding'), ('resolved'), ('cancelled');
    INSERT INTO public.content_reports VALUES ('pending'), ('resolved');
    INSERT INTO public.appeals VALUES ('pending'), ('approved');
    INSERT INTO public.disputes VALUES ('open'), ('resolved');
    INSERT INTO public.live_streams VALUES ('live'), ('ended');
    INSERT INTO public.posts VALUES ('${postId}', 'hidden');
    INSERT INTO public.content_review_queue (id, content_type, content_id) VALUES
      ('${reviewId}', 'post', '${postId}'), ('${missingReviewId}', 'post', '${id(90)}'),
      ('${otherReviewId}', 'video', '${id(91)}'), ('${rollbackReviewId}', 'post', '${postId}');
  `);
});

after(() => db.close());

test('anonymous, unassigned and moderator sessions cannot use the admin endpoints', async () => {
  await asUser(null, 'anon');
  await assert.rejects(snapshot(), { code: '42501' });
  await assert.rejects(resolve(reviewId, 'approve'), { code: '42501' });

  for (const user of [null, member, moderator]) {
    await asUser(user);
    await assert.rejects(snapshot(), { code: '42501' });
    await assert.rejects(resolve(reviewId, 'approve'), { code: '42501' });
    assert.equal((await db.query('SELECT role FROM public.user_roles WHERE user_id = $1', [user])).rows.length, 0);
  }
});

test('both admin roles see exact aggregate counts and seven ordered UTC dates', async () => {
  for (const [user, role] of [[admin, 'admin'], [superAdmin, 'super_admin']]) {
    await asUser(user);
    assert.deepEqual((await db.query('SELECT role FROM public.user_roles WHERE user_id = $1', [user])).rows, [{ role }]);
    assert.equal((await db.query('SELECT * FROM public.messages')).rows.length, 0);
    const result = parseAdminSnapshot(await snapshot());
    assert.equal(result.counts.messages, 2);
    assert.equal(result.counts.profiles, 3);
    assert.equal(result.counts.banned_profiles, 1);
    assert.equal(result.counts.active_sos, 2);
    assert.equal(result.counts.pending_reports, 1);
    assert.equal(result.counts.pending_reviews, 4);
    assert.equal(result.counts.live_streams, 1);
    assert.equal(result.counts.open_disputes, 1);
    assert.equal(result.counts.pending_appeals, 1);
    assert.equal(result.counts.orders, 0);
    assert.deepEqual(result.signups.map(({ count }) => count), [0, 0, 0, 0, 0, 1, 1]);
  }
});

test('missing or invalid snapshot values never become zero counts', async () => {
  await asUser(admin);
  const valid = await snapshot() as { counts: Record<string, number>; signups: unknown[] };
  const { messages: _missing, ...partialCounts } = valid.counts;
  for (const response of [null, { ...valid, counts: partialCounts }, { ...valid, signups: [] }, {
    ...valid, counts: { ...valid.counts, messages: -1 },
  }]) {
    assert.throws(() => parseAdminSnapshot(response), /Invalid admin dashboard response/);
  }
});

test('review decisions confirm one outcome, attribute the actor and reject duplicate resolutions', async () => {
  await asUser(admin);
  await assert.rejects(resolve(reviewId, 'unsupported'), { code: '22023' });
  await resolve(reviewId, 'approve', '  Checked  ');
  await assert.rejects(resolve(reviewId, 'reject'), { code: '55000' });
  await assert.rejects(resolve(missingReviewId, 'reject'), { code: 'P0002' });
  await resolve(otherReviewId, 'reject');

  await db.exec('RESET ROLE');
  assert.deepEqual((await db.query('SELECT moderation_status FROM public.posts')).rows, [{ moderation_status: 'active' }]);
  assert.deepEqual((await db.query(`SELECT status, resolved_by, resolution_notes FROM public.content_review_queue
    WHERE id IN ($1, $2, $3) ORDER BY id`, [reviewId, missingReviewId, otherReviewId])).rows, [
    { status: 'approved', resolved_by: admin, resolution_notes: 'Checked' },
    { status: 'pending', resolved_by: null, resolution_notes: null },
    { status: 'rejected', resolved_by: admin, resolution_notes: null },
  ]);
  assert.deepEqual((await db.query('SELECT action, admin_id FROM public.admin_audit_log ORDER BY action')).rows, [
    { action: 'queue_approve', admin_id: admin }, { action: 'queue_reject', admin_id: admin },
  ]);
});

test('audit writes cannot use another operator identity and a failed audit rolls back a decision', async () => {
  await db.exec(`ALTER TABLE public.admin_audit_log ADD CONSTRAINT fixture_fail_queue_write
    CHECK (details->>'review_id' IS DISTINCT FROM '${rollbackReviewId}')`);
  await asUser(superAdmin);
  await assert.rejects(db.query("INSERT INTO public.admin_audit_log (admin_id, action, target_type) VALUES ($1, 'manual', 'post')", [admin]), { code: '42501' });
  await db.query("INSERT INTO public.admin_audit_log (admin_id, action, target_type) VALUES ($1, 'manual', 'post')", [superAdmin]);
  await assert.rejects(resolve(rollbackReviewId, 'reject'), { code: '23514' });
  await db.exec('RESET ROLE');
  assert.deepEqual((await db.query('SELECT moderation_status FROM public.posts')).rows, [{ moderation_status: 'active' }]);
  assert.deepEqual((await db.query('SELECT status FROM public.content_review_queue WHERE id = $1', [rollbackReviewId])).rows, [{ status: 'pending' }]);
  await db.query("DELETE FROM public.user_roles WHERE user_id = $1 AND role = 'super_admin'", [superAdmin]);
  await asUser(superAdmin);
  await assert.rejects(snapshot(), { code: '42501' });
});
