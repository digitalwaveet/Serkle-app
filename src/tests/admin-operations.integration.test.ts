import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { parseAdminSnapshot } from '../lib/adminSnapshot.ts';

const db = new PGlite();
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [admin, superAdmin, moderator, member] = [1, 2, 3, 4].map(id);
const [postId, reviewId, missingReviewId, otherReviewId, rollbackReviewId] = [10, 11, 12, 13, 14].map(id);
const [report, circle, ownerRecord, memberRecord, question, answer] = [21, 22, 23, 24, 25, 26].map(id);
const expertRequest = id(27);
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

const readHoldings = async (balance: number | null = null, userId: string | null = null, limit = 10) =>
  (await db.query<{ holdings: any }>('SELECT get_admin_coin_holdings($1,$2,$3) holdings', [balance, userId, limit])).rows[0].holdings;

before(async () => {
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE public.profiles (created_at timestamptz, banned_at timestamptz, id uuid, name text, username text, is_verified boolean, admin_notes text);
    CREATE TABLE public.coin_wallets (user_id uuid PRIMARY KEY, balance integer NOT NULL, total_earned integer NOT NULL DEFAULT 0);
    CREATE TABLE public.posts (id uuid PRIMARY KEY, moderation_status text NOT NULL DEFAULT 'active', pinned_at timestamptz, content text, user_id uuid);
    CREATE TABLE public.videos (id uuid PRIMARY KEY, moderation_status text NOT NULL DEFAULT 'active');
    CREATE TABLE public.seller_profiles (user_id uuid);
    CREATE TABLE public.helper_profiles (user_id uuid);
    CREATE TABLE public.push_notifications (user_id uuid, notification_type text, title text, body text, data jsonb, delivery_status text);
    CREATE TABLE public.fixture_push_dispatches (user_id uuid);
    CREATE FUNCTION public.deliver_push_notification() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO public.fixture_push_dispatches VALUES (NEW.user_id); RETURN NEW; END;
    $$;
    CREATE TABLE public.messages (id integer);
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.messages TO authenticated;
    CREATE TABLE public.circles (id uuid PRIMARY KEY, name text, description text, category text,
      creator_id uuid, is_private boolean, is_premium boolean, is_active boolean, created_at timestamptz DEFAULT now(),
      subscription_enabled boolean, subscription_price integer);
    CREATE TABLE public.circle_stats (circle_id uuid PRIMARY KEY, members_count integer, posts_count integer, events_count integer);
    CREATE TABLE public.circle_members (id uuid PRIMARY KEY, user_id uuid, circle_id uuid, role text, status text, joined_at timestamptz DEFAULT now());
    ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.circles, public.circle_members TO authenticated;
    CREATE TABLE public.questions (id uuid PRIMARY KEY);
    CREATE TABLE public.answers (id uuid PRIMARY KEY, question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE);
    CREATE TABLE public.content_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_type text,
      status text, reviewed_by uuid, reviewed_at timestamptz, resolution_notes text);
    CREATE TABLE public.chapa_payment_intents (id uuid PRIMARY KEY, user_id uuid, tx_ref text, kind text,
      amount integer, currency text, mode text, status text, created_at timestamptz, verified_at timestamptz,
      credited_at timestamptz, reversed_at timestamptz, reserved_at timestamptz, restored_at timestamptz, submitted_at timestamptz,
      next_check_at timestamptz, check_lease_until timestamptz, checkout_lease_until timestamptz, attempts integer,
      last_error text, checkout_url text, destination_hint text, review_required boolean DEFAULT false);
    CREATE TABLE public.wallet_reconciliation_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mode text,
      started_at timestamptz, completed_at timestamptz, checked integer, errors integer);
    CREATE TABLE public.expert_verification_requests (id uuid PRIMARY KEY, user_id uuid, status text, specialty text,
      bio text, years_experience integer, professional_title text, qualification text, institution text,
      updated_at timestamptz DEFAULT now(), reviewed_at timestamptz, reviewed_by uuid, admin_notes text);
    CREATE TABLE public.expert_profiles (user_id uuid PRIMARY KEY, specialty text, years_experience integer, bio text,
      is_verified boolean, verified boolean);
    CREATE SCHEMA storage;
    CREATE TABLE storage.objects (bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT SELECT ON storage.objects TO authenticated;
  `);
  for (const table of ['stories', 'comments', 'orders']) {
    await db.exec(`CREATE TABLE public.${table} (id integer)`);
  }
  for (const table of ['sos_alerts', 'live_streams', 'appeals', 'disputes']) {
    await db.exec(`CREATE TABLE public.${table} (status text)`);
  }
  const roles = await migration('20260308175212_c4d8482b-60d0-48d4-b7d3-a8e4f1ab76ba.sql');
  await db.exec(roles.slice(0, roles.indexOf('-- 7.')));
  const queue = await migration('20260308182601_a851a824-5ced-4e28-975e-86039b95a3ed.sql');
  await db.exec(queue.slice(queue.indexOf('-- Content review queue table')));
  await db.exec(await migration('20260902142751_update_expert_profiles.sql'));
  await db.exec(`CREATE TRIGGER expert_verification_status_trigger AFTER UPDATE ON expert_verification_requests
    FOR EACH ROW EXECUTE FUNCTION handle_expert_verification_status();`);
  await db.exec(await migration('20261127120000_admin_operations.sql'));
  await db.exec(await migration('20261127190000_admin_workspace.sql'));
  await db.exec(await migration('20261128120000_admin_payment_controls.sql'));
  await db.exec(await migration('20260308183031_3f4b427c-2497-494c-bbd7-11b6392fe0fe.sql'));
  const bulk = await migration('20260308182144_d27501ff-d198-4140-8400-76a3d2f6cc21.sql');
  await db.exec(bulk.slice(0, bulk.indexOf('-- Enable realtime')));
  await db.exec(await migration('20260308181716_3c39db42-9c67-4b3f-9981-692501578202.sql'));
  await db.exec(await migration('20261128123000_admin_tool_connections.sql'));
  await db.exec(await migration('20261128160000_admin_coin_holdings.sql'));
  await db.exec(`
    GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
    GRANT SELECT ON public.user_roles TO authenticated;
    INSERT INTO auth.users VALUES ('${admin}'), ('${superAdmin}'), ('${moderator}'), ('${member}');
    INSERT INTO public.user_roles (user_id, role) VALUES
      ('${admin}', 'admin'), ('${superAdmin}', 'super_admin'), ('${moderator}', 'moderator');
    SET time zone 'Africa/Nairobi';
    INSERT INTO public.profiles (created_at, banned_at) VALUES (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC', NULL),
      ((date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 second') AT TIME ZONE 'UTC', now()),
      (now() - interval '8 days', NULL);
    INSERT INTO public.messages VALUES (1), (2);
    INSERT INTO public.sos_alerts VALUES ('active'), ('responding'), ('resolved'), ('cancelled');
    INSERT INTO public.content_reports (id, content_type, status)
      VALUES ('${report}', 'post', 'pending'), (gen_random_uuid(), 'post', 'resolved');
    INSERT INTO public.appeals VALUES ('pending'), ('approved');
    INSERT INTO public.disputes VALUES ('open'), ('resolved');
    INSERT INTO public.live_streams VALUES ('live'), ('ended');
    INSERT INTO public.posts VALUES ('${postId}', 'hidden');
    INSERT INTO public.content_review_queue (id, content_type, content_id) VALUES
      ('${reviewId}', 'post', '${postId}'), ('${missingReviewId}', 'post', '${id(90)}'),
      ('${otherReviewId}', 'video', '${id(91)}'), ('${rollbackReviewId}', 'post', '${postId}');
    INSERT INTO public.circles (id, name, creator_id, category, is_private, is_active)
      VALUES ('${circle}', 'Private fixture Circle', '${member}', 'Community', true, true);
    INSERT INTO public.circle_stats VALUES ('${circle}', 2, 7, 1);
    INSERT INTO public.circle_members (id, user_id, circle_id, status, role) VALUES
      ('${ownerRecord}', '${member}', '${circle}', 'active', 'member'), ('${memberRecord}', '${moderator}', '${circle}', 'active', 'member');
    INSERT INTO public.questions VALUES ('${question}');
    INSERT INTO public.answers VALUES ('${answer}', '${question}');
    INSERT INTO public.chapa_payment_intents (id, user_id, tx_ref, kind, amount, currency, mode, status,
      created_at, next_check_at, attempts, last_error, checkout_url, destination_hint)
      SELECT gen_random_uuid(), '${member}', 'live-' || n, 'topup', 50, 'ETB', 'live', 'pending',
        statement_timestamp(), statement_timestamp() - interval '1 hour', 2, 'private provider details', 'private checkout', 'private payout'
      FROM generate_series(1, 29) n;
    INSERT INTO public.chapa_payment_intents (id, user_id, tx_ref, kind, amount, currency, mode, status,
      created_at, next_check_at, attempts, check_lease_until)
      VALUES (gen_random_uuid(), '${member}', 'test-failed', 'withdrawal', 80, 'ETB', 'test', 'failed', now(), now(), 1, now() + interval '1 hour');
    INSERT INTO public.wallet_reconciliation_runs (mode, started_at, completed_at, checked, errors)
      VALUES ('live', now() - interval '2 minutes', now() - interval '1 minute', 25, 2), ('test', now(), NULL, 0, 0);
    INSERT INTO public.expert_verification_requests (id,user_id,status,specialty,updated_at)
      VALUES ('${expertRequest}', '${member}', 'pending', 'Education', '2026-11-01T00:00:00Z');
    INSERT INTO storage.objects VALUES ('expert_credentials'), ('private_other_bucket');
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
  await db.exec('RESET ROLE');
  await db.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'super_admin')", [superAdmin]);
});

test('wallet monitoring requires super admin and keeps payment modes and private fields separate', async () => {
  type WalletPage = {
    items: { id: string; created_at: string; tx_ref: string; has_check_error: boolean }[];
    summary: { pending: number; failed: number; due: number };
    latest_run: { errors: number; completed_at: string | null };
  };
  const wallet = async (mode: string, status = 'all', reference: string | null = null, cursor?: WalletPage['items'][number], kind = 'all') => {
    const { rows } = await db.query<{ result: WalletPage }>('SELECT get_admin_wallet_operations($1, $2, $3, $4, $5, $6) AS result',
      [mode, status, reference, cursor?.created_at ?? null, cursor?.id ?? null, kind]);
    return rows[0].result;
  };
  for (const user of [null, member, moderator, admin]) {
    await asUser(user, user ? 'authenticated' : 'anon');
    await assert.rejects(wallet('live'), { code: '42501' });
  }
  await asUser(superAdmin);
  await assert.rejects(wallet('both'), { code: '22023' });
  const live = await wallet('live');
  assert.deepEqual(live.summary, { pending: 29, failed: 0, due: 29 });
  assert.equal(live.latest_run.errors, 2);
  assert.equal(live.items.length, 26);
  assert.equal(live.items[0].has_check_error, true);
  assert.doesNotMatch(JSON.stringify(live), /private|user_id|checkout_url|destination_hint/);
  const next = await wallet('live', 'all', null, live.items[24]);
  assert.equal(new Set([...live.items.slice(0, 25), ...next.items].map((row) => row.id)).size, 29);
  const testMode = await wallet('test', 'failed', 'test-failed');
  assert.equal(testMode.items[0].tx_ref, 'test-failed');
  assert.deepEqual(testMode.summary, { pending: 0, failed: 1, due: 0 });
  assert.equal(testMode.latest_run.completed_at, null);
  assert.equal((await wallet('live', 'all', 'test-failed')).items.length, 0);
  assert.equal((await wallet('test', 'all', null, undefined, 'withdrawal')).items.length, 1);
  assert.deepEqual((await wallet('live', 'all', null, undefined, 'withdrawal')).summary, { pending: 0, failed: 0, due: 0 });
});

test('report and Ask actions enforce roles, reject duplicate decisions and retain an atomic audit', async () => {
  const decide = (status: string) => db.query('SELECT resolve_admin_report($1, $2, $3)', [report, status, '  notes  ']);
  const remove = (kind: string, content: string) => db.query('SELECT delete_admin_ask_content($1, $2)', [kind, content]);
  await asUser(member);
  await assert.rejects(decide('resolved'), { code: '42501' });
  await assert.rejects(remove('answer', answer), { code: '42501' });
  await asUser(admin);
  await assert.rejects(decide('pending'), { code: '22023' });
  await decide('resolved');
  await assert.rejects(decide('dismissed'), { code: '55000' });
  await assert.rejects(remove('other', answer), { code: '22023' });
  await remove('answer', answer);
  await assert.rejects(remove('answer', answer), { code: 'P0002' });
  await remove('question', question);
  await db.exec('RESET ROLE');
  assert.deepEqual((await db.query('SELECT status, reviewed_by, resolution_notes FROM content_reports WHERE id = $1', [report])).rows,
    [{ status: 'resolved', reviewed_by: admin, resolution_notes: 'notes' }]);
  assert.deepEqual((await db.query('SELECT action,admin_id FROM admin_audit_log WHERE target_id IN ($1,$2,$3) ORDER BY action', [report, question, answer])).rows,
    ['answer_deleted', 'question_deleted', 'report_resolved'].map((action) => ({ action, admin_id: admin })));
});

test('Circle directory exposes authorized metadata, protects actual ownership and confirms changes', async () => {
  const directory = () => db.query("SELECT id, members_count FROM list_admin_circles('fixture', 'General', 0)");
  const membership = () => db.query<{ id: string; status: string; is_owner: boolean }>('SELECT id, status, is_owner FROM list_admin_circle_members($1)', [circle]);
  const remove = (user: string) => db.query('SELECT remove_circle_member($1, $2)', [circle, user]);
  const deactivate = () => db.query('SELECT set_admin_circle_activity($1, false)', [circle]);
  await asUser(member);
  await assert.rejects(directory(), { code: '42501' });
  await assert.rejects(membership(), { code: '42501' });
  await assert.rejects(deactivate(), { code: '42501' });
  await asUser(admin);
  assert.deepEqual((await directory()).rows, [{ id: circle, members_count: 2 }]);
  assert.deepEqual((await membership()).rows.map((row) => row.is_owner), [true, false]);
  await assert.rejects(remove(member), { code: '42501' });
  await remove(moderator);
  await assert.rejects(remove(moderator), { code: '55000' });
  await deactivate();
  await assert.rejects(deactivate(), { code: '55000' });
  assert.deepEqual((await membership()).rows, [
    { id: ownerRecord, is_owner: true, status: 'active' }, { id: memberRecord, is_owner: false, status: 'removed' },
  ]);
  await db.exec('RESET ROLE');
  assert.deepEqual((await db.query('SELECT action FROM admin_audit_log WHERE target_id IN ($1,$2) ORDER BY action', [circle, memberRecord])).rows,
    [{ action: 'circle_deactivated' }, { action: 'member_removed' }]);
});

test('super admins can read credential files and review experts through the existing profile trigger', async () => {
  const files = () => db.query('SELECT bucket_id FROM storage.objects');
  const verify = (decision: string, notes?: string) => db.query('SELECT review_admin_expert_request($1,$2,$3,$4)',
    [expertRequest, decision, '2026-11-01T00:00:00Z', notes ?? null]);
  await asUser(member);
  assert.equal((await files()).rows.length, 0);
  await assert.rejects(verify('verified'), { code: '42501' });
  await asUser(superAdmin);
  assert.deepEqual((await files()).rows, [{ bucket_id: 'expert_credentials' }]);
  await assert.rejects(verify('more_information_required', ' '), { code: '22023' });
  await verify('verified');
  await assert.rejects(verify('suspended', 'Review incomplete'), { code: '55000' });
  await db.exec('RESET ROLE');
  assert.deepEqual((await db.query('SELECT user_id, is_verified, verified FROM expert_profiles')).rows,
    [{ user_id: member, is_verified: true, verified: true }]);
  assert.deepEqual((await db.query('SELECT admin_id FROM admin_audit_log WHERE target_id = $1', [expertRequest])).rows,
    [{ admin_id: superAdmin }]);
});

test('payment mode changes are service-only, audited and reject stale writes', async () => {
  const read = () => db.query('SELECT get_chapa_mode_override() AS mode');
  const change = (actor: string, mode: string, expected: string | null) => db.query('SELECT set_chapa_mode_override($1,$2,$3)', [actor, mode, expected]);
  await asUser(superAdmin);
  await assert.rejects(change(superAdmin, 'test', null), { code: '42501' });
  await db.exec('RESET ROLE; SET ROLE service_role');
  assert.deepEqual((await read()).rows, [{ mode: null }]);
  await assert.rejects(change(admin, 'test', null), { code: '42501' });
  await change(superAdmin, 'test', null);
  await assert.rejects(change(superAdmin, 'live', null), { code: '55000' });
  await change(superAdmin, 'live', 'test');
  assert.deepEqual((await read()).rows, [{ mode: 'live' }]);
  await db.query('SELECT audit_admin_withdrawal_check($1,$2)', [superAdmin, 'test-failed']);
  await assert.rejects(db.query('SELECT audit_admin_withdrawal_check($1,$2)', [superAdmin, 'live-1']), { code: 'P0002' });
  await db.exec('RESET ROLE');
  assert.equal((await db.query("SELECT * FROM admin_audit_log WHERE action='chapa_mode_changed'")).rows.length, 2);
});

test('admin dashboard actions update existing records and deliver idempotent in-app broadcasts and warnings', async () => {
  await db.exec(`INSERT INTO public.profiles (id) VALUES ('${member}'), ('${moderator}');
    INSERT INTO public.seller_profiles VALUES ('${member}');
    INSERT INTO public.videos VALUES ('${id(28)}', 'active');`);
  const broadcast = (requestId: string, channel: string) => db.query('SELECT send_admin_broadcast($1,$2,$3,$4,$5) AS count', [requestId, 'Admin fixture', 'Test inbox notice', 'sellers', channel]);
  await asUser(member);
  await assert.rejects(broadcast(id(29), 'in_app'), { code: '42501' });
  await asUser(admin);
  assert.deepEqual((await broadcast(id(29), 'in_app')).rows, [{ count: 1 }]);
  assert.deepEqual((await broadcast(id(29), 'in_app')).rows, [{ count: 1 }]);
  await assert.rejects(broadcast(id(29), 'both'), { code: '55000' });
  assert.deepEqual((await broadcast(id(30), 'both')).rows, [{ count: 1 }]);
  await db.query("SELECT issue_admin_warning($1,'warning','Review the rules','low')", [member]);
  await db.query("SELECT save_admin_moderation_status('video',$1,'hidden')", [id(28)]);
  await db.query('SELECT set_admin_post_pin($1,true)', [postId]);
  await db.query("SELECT save_admin_profile_status($1,'verify')", [member]);
  await assert.rejects(db.query("SELECT save_admin_profile_status($1,'ban')", [superAdmin]), { code: '42501' });
  await assert.rejects(db.query("SELECT apply_admin_bulk_action('posts','remove',$1)", [[postId, id(95)]]), { code: 'P0002' });
  await db.query("SELECT apply_admin_bulk_action('posts','hide',$1)", [[postId]]);
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT * FROM public.push_notifications')).rows.length, 3);
  assert.deepEqual((await db.query('SELECT * FROM public.fixture_push_dispatches')).rows, [{ user_id: member }]);
  assert.deepEqual((await db.query('SELECT moderation_status FROM public.videos')).rows, [{ moderation_status: 'hidden' }]);
  assert.equal((await db.query('SELECT * FROM public.bulk_action_logs')).rows.length, 1);
});

test('AI scans use stored rules, create one open review and require authenticated admin review', async () => {
  const scanned = id(31);
  await db.exec(`INSERT INTO posts (id,content,user_id) VALUES ('${scanned}','Fixture announcement','${member}');
    INSERT INTO auto_moderation_rules (name,rule_type,conditions,action) VALUES ('Fixture rule','keyword','{"keywords":["announcement"]}','flag');`);
  const record = (actor: string, content: string) => db.query<{ id: string }>("SELECT record_admin_post_scan($1,$2,$3,0.2,0.1,0,'low','Fixture analysis') AS id", [actor, scanned, content]);
  await db.exec('SET ROLE service_role');
  await assert.rejects(record(member, 'Fixture announcement'), { code: '42501' });
  await assert.rejects(record(admin, 'Outdated content'), { code: '55000' });
  const second = await record(admin, 'Fixture announcement');
  await record(admin, 'Fixture announcement');
  const review = () => db.query("SELECT review_admin_ai_results($1,'hidden')", [[second.rows[0].id]]);
  await asUser(member);
  await assert.rejects(review(), { code: '42501' });
  await asUser(admin);
  await review();
  await assert.rejects(review(), { code: '55000' });
  await db.exec('RESET ROLE');
  assert.deepEqual((await db.query('SELECT moderation_status FROM posts WHERE id=$1', [scanned])).rows, [{ moderation_status: 'hidden' }]);
  assert.equal((await db.query('SELECT * FROM content_review_queue WHERE content_id=$1', [scanned])).rows.length, 1);
});

test('coin circulation uses positive wallet balances, preserves tied ranks and requires a super admin', async () => {
  for (const user of [admin, moderator, member]) {
    await asUser(user);
    await assert.rejects(readHoldings(), { code: '42501' });
  }
  await asUser(null, 'anon');
  await assert.rejects(readHoldings(), { code: '42501' });
  await asUser(superAdmin);
  const empty = await readHoldings();
  assert.deepEqual(empty.summary, { circulating_coins: '0', holders: '0' });
  assert.deepEqual(empty.items, []);
  await assert.rejects(readHoldings(25), { code: '22023' });
  await assert.rejects(readHoldings(null, null, 51), { code: '22023' });

  const [holderA, holderB, holderC, overdrawn, emptyWallet] = [101, 102, 103, 104, 105].map(id);
  await db.exec('RESET ROLE');
  await db.query("INSERT INTO profiles(id,name,username) VALUES ($1,'First holder','firstholder')", [holderB]);
  await db.query(`INSERT INTO public.coin_wallets(user_id,balance,total_earned) VALUES
    ($1,2147483647,0),($2,2147483647,0),($3,16,9000),($4,-100,9000),($5,0,9000)`,
    [holderA, holderB, holderC, overdrawn, emptyWallet]);
  await asUser(superAdmin);
  const first = await readHoldings(null, null, 1);
  assert.deepEqual(first.summary, { circulating_coins: '4294967310', holders: '3' });
  assert.deepEqual(first.items.map((item: any) => item.user_id), [holderB, holderA]);
  assert.deepEqual(first.items[0], { user_id: holderB, balance: 2147483647, name: 'First holder', username: 'firstholder' });
  const second = await readHoldings(first.items[0].balance, first.items[0].user_id, 1);
  assert.deepEqual(second.summary, first.summary);
  assert.deepEqual(second.items.map((item: any) => item.user_id), [holderA, holderC]);
  assert.equal(second.items[0].name, null);
  const last = await readHoldings(second.items[0].balance, second.items[0].user_id, 1);
  assert.deepEqual(last.items.map((item: any) => item.user_id), [holderC]);
});
