import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchJoinedCircles, fetchOwnedCircles } from '../lib/circleCollections.ts';
import { allCirclePages, circleMembershipFlags, separateCircleCollections } from '../lib/circleMembership.ts';

const user = 'current-user';
const circle = (id: string, creator_id = 'another-user', count = 3) => ({
  id, creator_id, created_at: '2026-11-01T10:00:00Z',
  circle_stats: { members_count: count },
});
const membership = (circle_id: string, role = 'member', status = 'active', user_id = user) => ({
  id: `membership-${circle_id}-${user_id}`, circle_id, role, status, user_id,
});

/** Minimal read-only PostgREST fixture. Embedded filters run before ranges,
 * as the actual API does; root IDs remain distinct from membership roles. */
function clientFor(circles: ReturnType<typeof circle>[], members: ReturnType<typeof membership>[]) {
  const calls: { table: string; from: number; to: number; filters: any[]; orders: any[] }[] = [];
  return {
    calls,
    from(table: string) {
      const filters: { column: string; op: string; value: any }[] = [];
      const orders: { column: string; ascending: boolean }[] = [];
      let selection = '';
      const builder = {
        select(value: string) { selection = value; return builder; },
        eq(column: string, value: unknown) { filters.push({ column, op: 'eq', value }); return builder; },
        neq(column: string, value: unknown) { filters.push({ column, op: 'neq', value }); return builder; },
        in(column: string, value: unknown[]) { filters.push({ column, op: 'in', value }); return builder; },
        order(column: string, { ascending }: { ascending: boolean }) { orders.push({ column, ascending }); return builder; },
        async range(from: number, to: number) {
          calls.push({ table, from, to, filters: [...filters], orders: [...orders] });
          const matches = (row: any, filter: typeof filters[number]) => filter.op === 'eq'
            ? row[filter.column] === filter.value
            : filter.op === 'neq' ? row[filter.column] !== filter.value : filter.value.includes(row[filter.column]);
          let rows: any[] = (table === 'circles' ? circles : members)
            .filter(row => filters.filter(f => !f.column.includes('.')).every(f => matches(row, f)));
          if (table === 'circles' && selection.includes('circle_members!inner')) {
            rows = rows.map(row => ({ ...row, circle_members: members.filter(member => member.circle_id === row.id
              && filters.filter(f => f.column.startsWith('circle_members.')).every(f => matches(member, { ...f, column: f.column.split('.')[1] }))) }))
              .filter(row => row.circle_members.length > 0);
          }
          rows = [...rows].sort((a, b) => {
            for (const { column, ascending } of orders) {
              const result = String(a[column]).localeCompare(String(b[column]));
              if (result) return ascending ? result : -result;
            }
            return 0;
          });
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return builder;
    },
  };
}

test('an owner stored as an active creator member appears only in Created', async () => {
  const client = clientFor([circle('owned', user, 12)], [membership('owned', 'creator')]);
  const [created, joined] = await Promise.all([fetchOwnedCircles(client as any, user), fetchJoinedCircles(client as any, user)]);
  assert.deepEqual(created.map(row => row.circle.id), ['owned']);
  assert.deepEqual(joined, []);
  const flags = circleMembershipFlags(created[0].circle.creator_id, user, created[0].membership);
  assert.equal(flags.is_owned, true);
  assert.equal(flags.is_joined, true, 'listing exclusivity must not erase actual membership');
  assert.equal(flags.is_admin, true);
  assert.equal(flags.member_role, 'creator');
  assert.equal(created[0].circle.circle_stats.members_count, 12, 'the owner remains counted as a real member');
});

test('ownership without a membership row is still listed and retains creator permissions', async () => {
  const client = clientFor([circle('owned', user)], []);
  const created = await fetchOwnedCircles(client as any, user);
  assert.equal(created.length, 1);
  assert.deepEqual(circleMembershipFlags(user, user, created[0].membership), {
    is_owned: true, is_joined: false, is_pending: false, is_admin: true, member_role: undefined,
  });
  assert.deepEqual(await fetchJoinedCircles(client as any, user), []);
});

test('ordinary members, non-owner admins and moderators appear in Joined, not Created', async () => {
  const client = clientFor([circle('regular'), circle('admin'), circle('moderator')],
    [membership('regular'), membership('admin', 'admin'), membership('moderator', 'moderator')]);
  const joined = await fetchJoinedCircles(client as any, user);
  assert.equal(joined.length, 3);
  assert.deepEqual(await fetchOwnedCircles(client as any, user), []);
  const admin = joined.find(row => row.circle.id === 'admin')!;
  assert.equal(circleMembershipFlags(admin.circle.creator_id, user, admin.membership).is_admin, true);
});

test('mixed-role accounts have disjoint unique lists with unchanged counts and records', async () => {
  const circles = [circle('owner', user, 9), circle('owned-no-row', user, 0), circle('admin', 'other', 17), circle('member', 'other', 4)];
  const members = [membership('owner', 'creator'), membership('admin', 'admin'), membership('member')];
  const before = JSON.stringify({ circles, members });
  const client = clientFor(circles, members);
  const created = await fetchOwnedCircles(client as any, user);
  const joined = await fetchJoinedCircles(client as any, user);
  assert.equal(created.length, 2);
  assert.equal(joined.length, 2);
  const createdIds = new Set(created.map(row => row.circle.id));
  assert.equal(joined.some(row => createdIds.has(row.circle.id)), false);
  assert.deepEqual([...created, ...joined].map(row => row.circle.circle_stats.members_count).sort((a, b) => a - b), [0, 4, 9, 17]);
  assert.equal(JSON.stringify({ circles, members }), before);
});

test('Created uses the authoritative owner ID rather than an old creator role after transfer', async () => {
  const client = clientFor([circle('transferred', 'new-owner')], [membership('transferred', 'creator')]);
  assert.deepEqual(await fetchOwnedCircles(client as any, user), []);
  const joined = await fetchJoinedCircles(client as any, user);
  assert.equal(joined.length, 1);
  const flags = circleMembershipFlags('new-owner', user, joined[0].membership);
  assert.equal(flags.is_owned, false);
  assert.equal(flags.is_admin, true, 'existing management rights must not be removed by list categorization');
  assert.equal((await fetchOwnedCircles(client as any, 'new-owner')).length, 1);
});

test('pending/inactive memberships and subscription-only accounts do not populate Joined', async () => {
  const client = clientFor([circle('pending'), circle('banned'), circle('subscription-only'), circle('other-member')],
    [membership('pending', 'member', 'pending'), membership('banned', 'member', 'banned'), membership('other-member', 'member', 'active', 'someone-else')]);
  assert.deepEqual(await fetchJoinedCircles(client as any, user), []);
});

test('owner classification does not depend on membership status or role', async () => {
  for (const role of ['creator', 'admin', 'member']) {
    const client = clientFor([circle('owned', user)], [membership('owned', role, 'pending')]);
    assert.equal((await fetchOwnedCircles(client as any, user)).length, 1);
    assert.deepEqual(await fetchJoinedCircles(client as any, user), []);
  }
});

test('Joined excludes owners before pagination, with stable ordering and no skipped members', async () => {
  const circles = [circle('z-owned', user), circle('y-owned', user), circle('x-owned', user), circle('c'), circle('b'), circle('a')];
  const client = clientFor(circles, circles.map(c => membership(c.id, c.creator_id === user ? 'creator' : 'member')));
  const joined = await fetchJoinedCircles(client as any, user, 2);
  assert.deepEqual(joined.map(row => row.circle.id), ['c', 'b', 'a']);
  assert.deepEqual(client.calls.map(call => [call.from, call.to]), [[0, 1], [2, 3]]);
  assert.ok(client.calls.every(call => call.filters.some(f => f.column === 'creator_id' && f.op === 'neq' && f.value === user)));
  assert.ok(client.calls.every(call => call.orders.some(order => order.column === 'id')));
});

test('Created and its membership flags load beyond the first server page', async () => {
  const circles = ['a', 'b', 'c', 'd', 'e'].map(id => circle(id, user));
  const client = clientFor(circles, circles.map(c => membership(c.id, 'creator')));
  const created = await fetchOwnedCircles(client as any, user, 2);
  assert.deepEqual(created.map(row => row.circle.id), ['e', 'd', 'c', 'b', 'a']);
  assert.ok(created.every(row => row.membership.is_joined && row.membership.member_role === 'creator'));
  assert.equal(client.calls.filter(call => call.table === 'circles').length, 3);
  assert.equal(client.calls.filter(call => call.table === 'circle_members').length, 3);
});

test('repeated IDs across server pages produce one card per Circle', async () => {
  const owned = circle('owned', user);
  const joined = circle('joined');
  const client = clientFor([owned, owned, joined, joined], [membership('owned', 'creator'), membership('joined')]);
  assert.equal((await fetchOwnedCircles(client as any, user, 1)).length, 1);
  assert.equal((await fetchJoinedCircles(client as any, user, 1)).length, 1);
});

test('empty and signed-out accounts have empty lists without false ownership', async () => {
  const client = clientFor([], []);
  assert.deepEqual(await fetchOwnedCircles(client as any, user), []);
  assert.deepEqual(await fetchJoinedCircles(client as any, user), []);
  client.calls.length = 0;
  assert.deepEqual(await fetchOwnedCircles(client as any, ''), []);
  assert.deepEqual(await fetchJoinedCircles(client as any, ''), []);
  assert.equal(client.calls.length, 0);
  assert.equal(circleMembershipFlags(undefined as any, undefined, { is_joined: false, member_role: null }).is_owned, false);
});

test('a later-page failure rejects the collection rather than showing partial or false empty data', async () => {
  const error = new Error('Page unavailable');
  let calls = 0;
  await assert.rejects(allCirclePages(async () => ++calls === 1
    ? { data: [circle('one')], error: null }
    : { data: null, error }, 1), /Page unavailable/);
});

test('independently refreshed lists cannot duplicate an ownership-transfer Circle', () => {
  const ownerCard = { ...circle('shared', user, 14), is_joined: true, is_owned: true };
  const staleJoinedCard = { ...circle('shared', 'old-owner', 14), is_joined: true, is_owned: false };
  const memberCard = { ...circle('member'), is_joined: true, is_owned: false };
  const { created, joined } = separateCircleCollections([ownerCard, ownerCard], [staleJoinedCard, memberCard, memberCard]);
  assert.deepEqual(created, [ownerCard]);
  assert.deepEqual(joined, [memberCard]);
  assert.equal(created[0].is_joined, true);
  assert.equal(created[0].circle_stats.members_count, 14);
});
