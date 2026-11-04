import assert from 'node:assert/strict';
import test from 'node:test';
import { hasActivePresence, lastActiveText, mergeLastActivity, presenceTimestamp, PRESENCE_TTL_MS, resolvePresence } from '../lib/presenceStatus.ts';

const now = Date.parse('2026-11-02T10:00:00Z');
const userId = 'member-1';
const fresh = { user_id: userId, active: true, online_at: '2026-11-02T09:59:45Z' };
const historical = '2026-10-15T10:00:00Z';

test('active requires a fresh explicit signal received through available realtime', () => {
  assert.deepEqual(resolvePresence(userId, [fresh], true, historical, now), {
    state: 'active', isOnline: true, label: 'Online',
  });
  assert.equal(hasActivePresence(userId, [{ ...fresh, active: false }], true, now), false);
  assert.equal(hasActivePresence(userId, [{ ...fresh, active: undefined }], true, now), false);
  assert.equal(hasActivePresence(userId, [{ ...fresh, user_id: 'someone-else' }], true, now), false);
});

test('an offline member has no online indicator even with recent activity', () => {
  const offline = resolvePresence(userId, [], true, fresh.online_at, now);
  assert.equal(offline.state, 'offline');
  assert.equal(offline.isOnline, false);
  assert.match(offline.label!, /^Last active /);
  assert.deepEqual(resolvePresence(userId, [], true, null, now), { state: 'offline', isOnline: false, label: 'Offline' });
});

test('historical timestamps never imply online presence', () => {
  for (const available of [true, false]) {
    const status = resolvePresence(userId, [], available, historical, now);
    assert.equal(status.isOnline, false);
    assert.equal(status.label, 'Last active 18 days ago');
  }
  assert.equal(lastActiveText(historical, now), 'Last active 18 days ago');
  assert.match(lastActiveText(fresh.online_at, now)!, /^Last active /);
});

test('unknown and unsynchronized presence cannot use even a fresh cached session', () => {
  assert.deepEqual(resolvePresence(userId, [fresh], false, null, now), { state: 'unknown', isOnline: false, label: null });
  const disconnected = resolvePresence(userId, [fresh], false, historical, now);
  assert.equal(disconnected.isOnline, false);
  assert.equal(disconnected.label, 'Last active 18 days ago');
});

test('stale sessions expire at the freshness boundary without a leave event', () => {
  const onlineAt = new Date(now - PRESENCE_TTL_MS + 1).toISOString();
  assert.equal(hasActivePresence(userId, [{ ...fresh, online_at: onlineAt }], true, now), true);
  assert.equal(hasActivePresence(userId, [{ ...fresh, online_at: onlineAt }], true, now + 1), false);
  const stale = { ...fresh, online_at: historical };
  assert.equal(resolvePresence(userId, [stale], true, historical, now).isOnline, false);
});

test('all live sessions are considered and closing one session preserves another', () => {
  const stale = { ...fresh, online_at: historical };
  assert.equal(hasActivePresence(userId, [stale, fresh], true, now), true);
  assert.equal(hasActivePresence(userId, [fresh], true, now), true);
  assert.equal(hasActivePresence(userId, [stale], true, now), false);
});

test('explicit timezone offsets describe the same instant independent of local timezone', () => {
  for (const value of ['2026-11-02T09:59:45Z', '2026-11-02T12:59:45+03:00', '2026-11-02 09:59:45+00', '2026-11-02T05:59:45-0400']) {
    assert.equal(presenceTimestamp(value), Date.parse(fresh.online_at));
    assert.equal(hasActivePresence(userId, [{ ...fresh, online_at: value }], true, now), true);
    assert.equal(lastActiveText(value, now), lastActiveText(fresh.online_at, now));
  }
});

test('invalid, ambiguous and future timestamps never create an online indicator', () => {
  for (const online_at of ['', 'not a date', '2026-11-02', '2026-11-02T09:59:45', '2026-11-02T25:59:45Z', '2026-12-01T00:00:00Z']) {
    assert.equal(hasActivePresence(userId, [{ ...fresh, online_at }], true, now), false);
    assert.equal(lastActiveText(online_at, now), null);
  }
});

test('disconnect fallback uses real observed activity and never fabricates a new timestamp', () => {
  const observed = mergeLastActivity(new Map(), { [userId]: [fresh] }, now);
  const offline = mergeLastActivity(observed, {}, now + 100_000);
  assert.equal(offline.get(userId), new Date(fresh.online_at).toISOString());
  assert.equal(resolvePresence(userId, [], false, offline.get(userId), now + 100_000).isOnline, false);
  const older = mergeLastActivity(observed, { [userId]: [{ ...fresh, online_at: historical }] }, now);
  assert.equal(older.get(userId), observed.get(userId));
});

test('missing identity, inactive or future payloads do not create activity history', () => {
  const snapshot = { [userId]: [
    { ...fresh, user_id: 'someone-else' },
    { ...fresh, active: false },
    { ...fresh, online_at: '2026-12-01T00:00:00Z' },
  ] };
  assert.equal(mergeLastActivity(new Map(), snapshot, now).size, 0);
});
