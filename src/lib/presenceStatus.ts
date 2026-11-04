import { formatDistance } from 'date-fns';

export const PRESENCE_HEARTBEAT_MS = 30_000;
export const PRESENCE_TTL_MS = 90_000;
const CLOCK_SKEW_MS = 5_000;

export interface PresenceSession {
  user_id?: string;
  online_at?: string;
  active?: boolean;
}
export type PresenceSnapshot = Record<string, PresenceSession[]>;

/** Require an explicit timezone; never interpret backend activity in local time. */
export function presenceTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value)) return null;
  const normalized = value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function lastActiveText(value: unknown, now = Date.now()): string | null {
  const timestamp = presenceTimestamp(value);
  if (timestamp === null || timestamp > now) return null;
  return `Last active ${formatDistance(timestamp, now, { addSuffix: true })}`;
}

export function hasActivePresence(userId: string, sessions: PresenceSession[], available: boolean, now = Date.now()): boolean {
  return available && sessions.some(session => {
    const timestamp = presenceTimestamp(session.online_at);
    return session.user_id === userId && session.active === true && timestamp !== null
      && now - timestamp >= -CLOCK_SKEW_MS && now - timestamp < PRESENCE_TTL_MS;
  });
}

export function resolvePresence(
  userId: string,
  sessions: PresenceSession[],
  available: boolean,
  lastActiveAt?: string | null,
  now = Date.now(),
) {
  const isOnline = hasActivePresence(userId, sessions, available, now);
  return {
    state: isOnline ? 'active' as const : available ? 'offline' as const : 'unknown' as const,
    isOnline,
    label: isOnline ? 'Online' : lastActiveText(lastActiveAt, now) ?? (available ? 'Offline' : null),
  };
}

/** Keep real observed activity for fallback text, never invent a disconnect time. */
export function mergeLastActivity(previous: Map<string, string>, snapshot: PresenceSnapshot, now = Date.now()) {
  const next = new Map(previous);
  for (const [userId, sessions] of Object.entries(snapshot)) {
    for (const session of sessions) {
      const timestamp = presenceTimestamp(session.online_at);
      if (session.user_id !== userId || session.active !== true || timestamp === null || timestamp > now) continue;
      const existing = presenceTimestamp(next.get(userId));
      if (existing === null || timestamp > existing) next.set(userId, new Date(timestamp).toISOString());
    }
  }
  return next;
}
