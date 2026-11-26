const LOCAL_KEY_SEED_PREFIX = "SERKLE_CHAT_KEY_SEED_";

export interface KeyValueStorageLike {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function generateRandomHex(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function defaultStorage(): KeyValueStorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Returns a stable per-user encryption seed persisted in localStorage for the
 * lifetime of the sign-in session. Unlike rotating JWT access tokens, this stays
 * identical across token refreshes and across multiple open tabs for the same user,
 * preventing cross-tab Dexie decryption mismatches.
 */
export function getOrCreateLocalEncryptionSeed(
  userId: string,
  storage: KeyValueStorageLike | null = defaultStorage(),
): string {
  const storageKey = `${LOCAL_KEY_SEED_PREFIX}${userId}`;
  if (!storage) {
    return `${userId}:fallback-session-seed`;
  }

  try {
    const existing = storage.getItem(storageKey);
    if (existing) {
      return `${userId}:${existing}`;
    }

    // Remove seeds belonging to any previous user on this device.
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key && key.startsWith(LOCAL_KEY_SEED_PREFIX) && key !== storageKey) {
        storage.removeItem(key);
      }
    }

    const created = generateRandomHex(32);
    storage.setItem(storageKey, created);
    return `${userId}:${created}`;
  } catch {
    return `${userId}:fallback-session-seed`;
  }
}

export function clearLocalEncryptionSeeds(
  storage: KeyValueStorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key && key.startsWith(LOCAL_KEY_SEED_PREFIX)) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access errors in restricted environments.
  }
}

export function isDexieDecryptionError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error ?? "");
  return /dexie-encrypted was unable to decrypt an entity|unable to decrypt an entity/i.test(
    message,
  );
}
