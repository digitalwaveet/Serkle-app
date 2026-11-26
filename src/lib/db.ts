import { Dexie, type Table } from "dexie";
import {
  applyEncryptionMiddleware,
  ENCRYPT_LIST,
  clearAllTables,
} from "dexie-encrypted";
import {
  clearLocalEncryptionSeeds,
  getOrCreateLocalEncryptionSeed,
  isDexieDecryptionError,
} from "./chatEncryption";

export {
  clearLocalEncryptionSeeds,
  getOrCreateLocalEncryptionSeed,
  isDexieDecryptionError,
};

const ENCRYPTION_VERSION = "v6_premium_profile";
const ENCRYPTION_VERSION_KEY = "SERKLE_DB_ENCRYPTION_VERSION";

export interface LocalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  attachment_url: string;
  reply_to_id: string;
  forwarded_from_name?: string;
  is_edited?: boolean;
  deleted_for_everyone?: boolean;
  created_at: string;
  updated_at: string;
  seq?: number;
  created_seq?: number;
  sync_status: "pending" | "sending" | "sent" | "delivered" | "read" | "failed";
  sync_error?: string;
  sync_error_code?: string;
}

export interface LocalConversationMeta {
  conversation_id: string;
  other_user_id: string | null;
  other_user_name: string;
  other_user_username: string | null;
  other_user_avatar: string | null;
  other_user_initials: string;
  other_user_online: boolean;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  unread_read_seq?: number;
  unread_latest_seq?: number;
  is_group: boolean;
  group_name: string | null;
  group_avatar_url: string | null;
  member_count: number;
}

export interface LocalProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  initials: string;
}

export interface LocalReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

/** Call this before any Dexie write to guarantee no null leaks into encrypted fields */
export function sanitizeMessage(msg: Partial<LocalMessage>): LocalMessage {
  const ensureString = (val: any, fallback: string = ""): string => {
    if (typeof val === "string") return val;
    if (val === null || val === undefined) return fallback;
    return String(val);
  };

  return {
    id: msg.id!,
    conversation_id: msg.conversation_id!,
    sender_id: ensureString(msg.sender_id),
    content: ensureString(msg.content),
    message_type: ensureString(msg.message_type, "text"),
    attachment_url: ensureString(msg.attachment_url),
    reply_to_id: ensureString(msg.reply_to_id),
    forwarded_from_name: ensureString(msg.forwarded_from_name),
    is_edited: !!msg.is_edited,
    deleted_for_everyone: !!msg.deleted_for_everyone,
    created_at: msg.created_at!,
    updated_at: msg.updated_at!,
    seq: msg.seq,
    created_seq: msg.created_seq,
    sync_status: msg.sync_status ?? "pending",
  } as LocalMessage;
}

export interface LocalConversation {
  id: string;
  last_seen_seq: number;
}

export interface LocalReadReceipt {
  user_id: string;
  conversation_id: string;
  last_read_seq: number;
  updated_at: string;
}

export interface LocalPinnedConversation {
  conversation_id: string;
  user_id: string;
  pinned_at: string;
}

export interface LocalSyncQueueItem {
  id: string;
  type:
    | "message_insert"
    | "message_update"
    | "message_delete"
    | "read_receipt"
    | "story_view"
    | "story_like"
    | "story_unlike"
    | "story_message";
  payload: any;
  created_at: string;
  retry_count: number;
  status?: "pending" | "processing" | "failed";
}

export class ChatDatabase extends Dexie {
  messages!: Table<LocalMessage, string>;
  message_reactions!: Table<LocalReaction, string>;
  conversations!: Table<{ id: string; last_seen_seq: number }, string>;
  conversations_meta!: Table<LocalConversationMeta, string>;
  read_receipts!: Table<LocalReadReceipt, [string, string]>; // Composite key [conversation_id, user_id]
  sync_queue!: Table<LocalSyncQueueItem, string>;
  pinned_conversations!: Table<LocalPinnedConversation, string>;
  profiles!: Table<LocalProfile, string>;

  private resolveEncryptionKey!: (key: Uint8Array) => void;
  private encryptionInitialized = false;

  constructor() {
    super("SerkleChatDB_v4");

    // Schema version 2 - Added profiles table
    // The keys listed here are the indexed fields. Everything else is unindexed payload.
    // @ts-ignore - TS sometimes fails to resolve the Dexie base class methods properly
    this.version(4).stores({
      messages:
        "id, conversation_id, created_at, [conversation_id+created_at], sync_status",
      conversations: "id",
      conversations_meta: "conversation_id",
      read_receipts: "[conversation_id+user_id], conversation_id",
      sync_queue: "id, type, created_at",
      message_reactions: "id, message_id, [message_id+user_id+emoji]",
      pinned_conversations: "conversation_id",
      profiles: "id, username",
    });

    // Defer the encryption key so Dexie blocks queries until we provide it from UserContext
    const keyPromise = new Promise<Uint8Array>((resolve) => {
      this.resolveEncryptionKey = resolve;
    });

    // Apply dexie-encrypted middleware BEFORE the DB officially opens
    try {
      // @ts-ignore - TS types for dexie-encrypted might clash with Dexie 4.0 Table types
      (applyEncryptionMiddleware as any)(
        this,
        keyPromise,
        {
          messages: {
            type: ENCRYPT_LIST,
            fields: [
              "content",
              "attachment_url",
              "sender_id",
              "message_type",
              "reply_to_id",
            ],
          },
        } as any,
        async (db) => {
          console.warn(
            "[Dexie] Encryption key changed or invalid, clearing local tables to prevent crash.",
          );
          await clearAllTables(db);
        },
      );
    } catch (e) {
      console.error("Dexie encryption middleware setup failed", e);
    }
  }

  // Initialize DB with a stable per-user local key so JWT refreshes and multiple tabs share the same key.
  async initEncryptionForUser(userId: string) {
    if (!userId) return;
    await this.initEncryption(getOrCreateLocalEncryptionSeed(userId));
  }

  // Initialize DB with encryption key derived from provided key material
  async initEncryption(sessionToken: string) {
    if (!sessionToken || this.encryptionInitialized) return;

    // Request persistent storage if available
    try {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log(`Persistent storage granted: ${isPersisted}`);
      }
    } catch (e) {
      console.error("Failed to request persistent storage", e);
    }

    try {
      // Derive a 32-byte key from the key material using Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(sessionToken);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const encryptionKey = new Uint8Array(hashBuffer);

      // Self-Healing Clear: Wipe corrupted legacy data if version mismatch
      let storedVersion: string | null = null;
      try {
        storedVersion = localStorage.getItem(ENCRYPTION_VERSION_KEY);
      } catch {
        storedVersion = ENCRYPTION_VERSION;
      }

      if (storedVersion !== ENCRYPTION_VERSION) {
        console.warn(
          `[Dexie] Encryption version mismatch (${storedVersion} -> ${ENCRYPTION_VERSION}). Nuclear reset...`,
        );
        try {
          localStorage.setItem(ENCRYPTION_VERSION_KEY, ENCRYPTION_VERSION);
        } catch {
          // Ignore storage write errors in restricted environments.
        }
        await this.delete(); // Nukes the specific DB name
        window.location.reload(); // Force refresh to re-init with clean DB
        return;
      }

      // Release the promise, allowing Dexie to process deferred queries ONLY after version check
      this.encryptionInitialized = true;
      this.resolveEncryptionKey(encryptionKey);

      console.log("Chat local database encryption initialized and unblocked.");
    } catch (err) {
      console.error("Failed to initialize local DB encryption key", err);
    }
  }
}

// Export a singleton instance
export const chatDb = new ChatDatabase();

let decryptionRecoveryPromise: Promise<void> | null = null;

/**
 * Self-heals local encrypted chat tables when an entity cannot be decrypted
 * (e.g. a row written by a stale tab or legacy rotating-token key).
 * Clears encrypted messages and conversation delta cursors so remote sync cleanly repopulates them.
 */
export async function recoverCorruptedEncryptedCache(): Promise<void> {
  if (decryptionRecoveryPromise) return decryptionRecoveryPromise;

  decryptionRecoveryPromise = (async () => {
    console.warn(
      "[Dexie] Undecryptable entity detected in local chat cache; clearing encrypted message cache to recover.",
    );
    try {
      await Promise.all([
        chatDb.messages.clear(),
        chatDb.conversations.clear(),
      ]);
    } catch (clearError) {
      console.error(
        "[Dexie] Partial encrypted cache clear failed, clearing all local tables:",
        clearError,
      );
      try {
        await clearAllTables(chatDb);
      } catch {
        await chatDb.delete().catch(() => {});
      }
    }
  })().finally(() => {
    decryptionRecoveryPromise = null;
  });

  return decryptionRecoveryPromise;
}
