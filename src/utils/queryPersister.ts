import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const IDB_KEY = 'rq-cache';

// Query keys that should be persisted to IndexedDB
const PERSISTED_QUERY_KEYS = [
  'user-profile',
  'conversations',
  'follows',
  'posts',
  'videos',
  'circles',
  'notifications',
  'user-preferences',
  'shop-items',
  'saved-posts',
  'saved-videos',
  'coin-wallet',
];

// 24 hours max age
export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24;

/**
 * Filter persisted client to only include queries we care about caching locally.
 */
const filterClient = (client: PersistedClient): PersistedClient => ({
  ...client,
  clientState: {
    ...client.clientState,
    queries: client.clientState.queries.filter((q) => {
      const key = q.queryKey[0];
      return typeof key === 'string' && PERSISTED_QUERY_KEYS.includes(key);
    }),
    mutations: [], // never persist pending mutations
  },
});

/**
 * Creates an IndexedDB-backed persister for React Query.
 */
export const createIDBPersister = (): Persister => ({
  persistClient: async (client: PersistedClient) => {
    try {
      await set(IDB_KEY, filterClient(client));
    } catch {
      // Silently fail — storage full or private browsing
    }
  },
  restoreClient: async () => {
    try {
      return await get<PersistedClient>(IDB_KEY);
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await del(IDB_KEY);
    } catch {
      // ignore
    }
  },
});

/**
 * Request persistent storage so the OS doesn't evict our cache.
 */
export const requestPersistentStorage = async () => {
  if (navigator.storage?.persist) {
    const granted = await navigator.storage.persist();
    if (granted) {
      console.log('Persistent storage granted');
    }
  }
};

/**
 * Clear the IndexedDB cache (used by forceRefresh).
 */
export const clearIDBCache = async () => {
  try {
    await del(IDB_KEY);
  } catch {
    // ignore
  }
};
