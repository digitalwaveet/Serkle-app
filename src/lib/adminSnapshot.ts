const countKeys = [
  'profiles', 'banned_profiles', 'posts', 'videos', 'stories', 'comments', 'messages',
  'circles', 'questions', 'orders', 'live_streams', 'pending_reports', 'pending_appeals',
  'pending_reviews', 'open_disputes', 'active_sos',
] as const;

type CountKey = typeof countKeys[number];

export interface AdminSnapshot {
  checkedAt: Date;
  counts: Record<CountKey, number>;
  signups: { day: string; count: number }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function parseAdminSnapshot(value: unknown): AdminSnapshot {
  const invalid = new Error('Invalid admin dashboard response');
  if (!isRecord(value) || !isRecord(value.counts) || typeof value.checked_at !== 'string') throw invalid;
  const checkedAt = new Date(value.checked_at);
  if (!Number.isFinite(checkedAt.getTime()) || !Array.isArray(value.signups) || value.signups.length !== 7) {
    throw invalid;
  }

  const counts = {} as AdminSnapshot['counts'];
  for (const key of countKeys) {
    const count = value.counts[key];
    if (!isCount(count)) throw invalid;
    counts[key] = count;
  }

  const signups = value.signups.map((entry: unknown, index) => {
    const expected = new Date(checkedAt);
    expected.setUTCDate(expected.getUTCDate() + index - 6);
    if (!isRecord(entry) || entry.day !== expected.toISOString().slice(0, 10) || !isCount(entry.count)) {
      throw invalid;
    }
    return { day: entry.day, count: entry.count };
  });

  return { checkedAt, counts, signups };
}
