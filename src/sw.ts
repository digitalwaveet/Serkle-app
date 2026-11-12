/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { saveShareDraft } from './lib/shareDraft';

declare let self: ServiceWorkerGlobalScope;

// Register navigations before the precache route, which also matches "/" and
// "/index.html". The offline fallback stays paired with this worker's assets.
if (import.meta.env.PROD) registerRoute(new NavigationRoute(async ({ request }) => {
  try {
    return await fetch(request, { cache: 'no-cache' });
  } catch (error) {
    const offlineShell = await matchPrecache('/index.html');
    if (offlineShell) return offlineShell;
    throw error;
  }
}, {
  denylist: [
    /^\/(?:\.well-known|api|assets|auth|storage|share-target)(?:[/?]|$)/,
    /\.[a-z0-9]+(?:\?|$)/i,
  ],
}));

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const rescueClientIds = new Set<string>();

function isClientHealthy(client: WindowClient): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), 600);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(Boolean(event.data?.healthy));
    };
    try {
      client.postMessage({ type: 'SERKLE_CLIENT_STATUS' }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

// Installation alone must not replace a healthy running version with unsaved
// work, but if an open tab is stuck on an older or crashed bundle, promote
// immediately so it can recover without manual DevTools intervention.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window' });
    if (clients.length === 0) return;
    const statuses = await Promise.all(
      clients.map(async (client) => ({
        id: client.id,
        healthy: await isClientHealthy(client),
      })),
    );
    for (const status of statuses) {
      if (!status.healthy) rescueClientIds.add(status.id);
    }
    if (rescueClientIds.size > 0) {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    if (rescueClientIds.size > 0) {
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(
        clients
          .filter((client) => rescueClientIds.has(client.id) && 'navigate' in client)
          .map((client) => client.navigate(client.url).catch(() => {})),
      );
      rescueClientIds.clear();
    }
  })());
});

registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname === '/share-target',
  async ({ request }) => {
    try {
      const id = await saveShareDraft(await request.formData());
      return Response.redirect(new URL(`/share?draft=${id}`, self.location.origin).href, 303);
    } catch {
      return Response.redirect(new URL('/share?error=invalid', self.location.origin).href, 303);
    }
  },
  'POST'
);

// Bypass SW for Supabase Storage (Fix for Video Range Requests / ERR_CACHE_OPERATION_NOT_SUPPORTED)
registerRoute(
  ({ url }) => /\/storage\/v1\/object\/(public|sign|authenticated)\//.test(url.pathname),
  new NetworkOnly()
);

// Handle Push Events — this runs even when every app window is closed, so
// the notification lands in the system tray / notification shade.
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  let payload: any = { title: 'New Notification', body: 'You have a new update!', icon: '/icon-192.png', data: {} };

  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    console.warn('[Service Worker] Push data was not JSON:', event.data?.text());
    payload.body = event.data?.text() || payload.body;
  }

  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean; actions?: { action: string; title: string }[] } = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: payload.data || {},
    // Same-type notifications replace each other instead of flooding the
    // shade; renotify still alerts (sound/vibration) on each replacement
    tag: payload.tag || 'serkle-notification',
    renotify: true,
    // Emergency notifications stay visible until the user interacts
    requireInteraction: !!payload.requireInteraction,
    actions: [
      { action: 'open', title: 'Open App' }
    ]
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, options);
      // Badge the installed app icon so missed notifications are visible
      // even after the shade is swiped away
      try {
        await (self.navigator as any).setAppBadge?.();
      } catch { /* Badging API not supported — fine */ }
    })()
  );
});

// Handle Notification Clicks — focus the app if it's running and navigate to
// the notification's target; otherwise open a fresh window on it.
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close();

  let urlToOpen = new URL('/notifications', self.location.origin).href;
  try {
    const candidate = new URL(event.notification.data?.url || '/notifications', self.location.origin);
    if (candidate.origin === self.location.origin) urlToOpen = candidate.href;
  } catch { /* Keep the safe, same-origin fallback. */ }

  event.waitUntil(
    (async () => {
      try {
        await (self.navigator as any).clearAppBadge?.();
      } catch { /* ignore */ }

      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Reuse an existing window: navigate it to the target and focus
      for (const client of windowClients) {
        if ('focus' in client) {
          try {
            if ('navigate' in client && new URL(client.url).origin === self.location.origin) {
              await (client as WindowClient).navigate(urlToOpen);
            }
          } catch { /* navigation blocked — still focus */ }
          return client.focus();
        }
      }

      // No window open — launch one directly on the target
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })()
  );
});

// Browsers rotate push subscriptions from time to time; without this handler
// pushes silently stop until the user reopens the app. Resubscribe right here
// in the background — the app re-saves the fresh subscription to the backend
// on its next launch (and stale endpoints are pruned server-side on 410).
self.addEventListener('pushsubscriptionchange', (event: any) => {
  console.log('[Service Worker] Push subscription changed, resubscribing...');
  const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
  if (!applicationServerKey) return;

  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
  );
});

// Handle Background Sync
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'chat-sync') {
    console.log('[Service Worker] Background Sync Triggered!');
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          // Tell the open window (which has Supabase Auth Context) to process the queue
          clients.forEach(client => client.postMessage({ type: 'PROCESS_SYNC_QUEUE' }));
        } else {
          // If no windows are open, we'd ideally run a direct sync here.
          // However, Supabase auth requires localStorage (unavailable in SW) or an IndexedDB session sharing mechanism.
          throw new Error('No authenticated window is available; retry when the app opens.');
        }
      })
    );
  }
});
