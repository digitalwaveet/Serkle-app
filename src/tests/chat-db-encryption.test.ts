import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearLocalEncryptionSeeds,
  getOrCreateLocalEncryptionSeed,
  isDexieDecryptionError,
  type KeyValueStorageLike,
} from "../lib/chatEncryption.ts";

function createMemoryStorage(): KeyValueStorageLike {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

test("getOrCreateLocalEncryptionSeed stays stable for the same user across reloads/tabs and rotates across users", () => {
  const storage = createMemoryStorage();
  storage.setItem("unrelated_key", "keep-me");

  const first = getOrCreateLocalEncryptionSeed("user-a", storage);
  const second = getOrCreateLocalEncryptionSeed("user-a", storage);
  assert.equal(first, second);
  assert.ok(first.startsWith("user-a:"));
  assert.equal(storage.getItem("unrelated_key"), "keep-me");

  // Switching to another user creates a distinct seed and evicts the previous user's seed.
  const otherUser = getOrCreateLocalEncryptionSeed("user-b", storage);
  assert.notEqual(otherUser, first);
  assert.equal(storage.getItem("SERKLE_CHAT_KEY_SEED_user-a"), null);
  assert.ok(storage.getItem("SERKLE_CHAT_KEY_SEED_user-b"));

  // Logging out clears all local encryption seeds while leaving unrelated keys intact.
  clearLocalEncryptionSeeds(storage);
  assert.equal(storage.getItem("SERKLE_CHAT_KEY_SEED_user-b"), null);
  assert.equal(storage.getItem("unrelated_key"), "keep-me");

  // Re-logging in generates a fresh seed.
  const relogin = getOrCreateLocalEncryptionSeed("user-b", storage);
  assert.notEqual(relogin, otherUser);
});

test("isDexieDecryptionError accurately identifies dexie-encrypted entity failures", () => {
  assert.equal(
    isDexieDecryptionError(new Error("Dexie-encrypted was unable to decrypt an entity.")),
    true,
  );
  assert.equal(
    isDexieDecryptionError({ message: "Dexie-encrypted was unable to decrypt an entity." }),
    true,
  );
  assert.equal(isDexieDecryptionError(new Error("Network error")), false);
  assert.equal(isDexieDecryptionError(null), false);
});
