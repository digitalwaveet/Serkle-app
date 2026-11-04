import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { mergeLastActivity, PRESENCE_HEARTBEAT_MS, resolvePresence, type PresenceSnapshot } from '@/lib/presenceStatus';

interface PresenceContextType {
  onlineUsers: Set<string>;
  isUserOnline: (userId: string) => boolean;
  getLastSeen: (userId: string) => string | null;
  getLastSeenText: (userId: string) => string | null;
  getUserPresence: (userId: string) => ReturnType<typeof resolvePresence>;
}

interface PresenceView {
  ownerId?: string;
  snapshot: PresenceSnapshot;
  available: boolean;
  lastActivity: Map<string, string>;
  now: number;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider: React.FC<{ userId: string | undefined; children: ReactNode }> = ({ userId, children }) => {
  const [view, setView] = useState<PresenceView>({ snapshot: {}, available: false, lastActivity: new Map(), now: Date.now() });

  useEffect(() => {
    let disposed = false;
    let subscribed = false;
    let synced = false;
    let tracking = false;
    let snapshot: PresenceSnapshot = {};
    let lastActivity = new Map<string, string>();
    const foreground = () => navigator.onLine && document.visibilityState === 'visible';
    const publish = () => {
      if (disposed) return;
      const now = Date.now();
      lastActivity = mergeLastActivity(lastActivity, snapshot, now);
      setView({ ownerId: userId, snapshot, available: subscribed && synced && foreground(), lastActivity, now });
    };
    const invalidate = () => {
      synced = false;
      snapshot = {};
      publish();
    };
    publish();
    if (!userId) return () => { disposed = true; };

    const channel = supabase.channel('online-users', { config: { presence: { key: userId } } });
    const heartbeat = async () => {
      if (disposed || !subscribed || !foreground() || tracking) return;
      tracking = true;
      try {
        const result = await channel.track({ user_id: userId, online_at: new Date().toISOString(), active: true });
        if (!disposed && result !== 'ok') invalidate();
      } catch {
        if (!disposed) invalidate();
      } finally {
        tracking = false;
      }
    };

    channel.on('presence', { event: 'sync' }, () => {
      if (disposed || !subscribed || !foreground()) return;
      // Use the full server snapshot so closing one tab preserves other sessions.
      snapshot = channel.presenceState() as PresenceSnapshot;
      synced = true;
      publish();
    }).subscribe(status => {
      if (disposed) return;
      subscribed = status === 'SUBSCRIBED';
      invalidate();
      if (subscribed) void heartbeat();
    });

    const onEnvironmentChange = () => {
      invalidate();
      if (foreground()) void heartbeat();
      else void channel.untrack().catch(() => undefined);
    };
    window.addEventListener('offline', onEnvironmentChange);
    window.addEventListener('online', onEnvironmentChange);
    document.addEventListener('visibilitychange', onEnvironmentChange);
    const heartbeatTimer = setInterval(() => { void heartbeat(); }, PRESENCE_HEARTBEAT_MS);
    // Expire stale sessions even when no server leave event arrives.
    const expiryTimer = setInterval(publish, 5000);

    return () => {
      disposed = true;
      clearInterval(heartbeatTimer);
      clearInterval(expiryTimer);
      window.removeEventListener('offline', onEnvironmentChange);
      window.removeEventListener('online', onEnvironmentChange);
      document.removeEventListener('visibilitychange', onEnvironmentChange);
      void channel.untrack().catch(() => undefined);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // Never expose another account's snapshot during a sign-in transition.
  const getUserPresence = useCallback((checkUserId: string) => resolvePresence(
    checkUserId,
    view.ownerId === userId ? view.snapshot[checkUserId] || [] : [],
    view.ownerId === userId && view.available,
    view.ownerId === userId ? view.lastActivity.get(checkUserId) : null,
    view.now,
  ), [userId, view]);
  const onlineUsers = useMemo(() => new Set(Object.keys(view.snapshot).filter(id => getUserPresence(id).isOnline)), [view.snapshot, getUserPresence]);
  const isUserOnline = useCallback((checkUserId: string) => getUserPresence(checkUserId).isOnline, [getUserPresence]);
  const getLastSeen = useCallback((checkUserId: string) => view.ownerId === userId ? view.lastActivity.get(checkUserId) || null : null, [view, userId]);
  // Preserve the messaging API; Circle consumes structured status and neutral history.
  const getLastSeenText = useCallback((checkUserId: string) => {
    if (isUserOnline(checkUserId)) return 'Online';
    const lastSeen = getLastSeen(checkUserId);
    return lastSeen ? `last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: false })} ago` : null;
  }, [isUserOnline, getLastSeen]);

  return <PresenceContext.Provider value={{ onlineUsers, isUserOnline, getLastSeen, getLastSeenText, getUserPresence }}>{children}</PresenceContext.Provider>;
};

export const usePresenceContext = () => {
  const context = useContext(PresenceContext);
  if (context === undefined) throw new Error('usePresenceContext must be used within a PresenceProvider');
  return context;
};
