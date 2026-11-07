import { supabase } from "@/integrations/supabase/client";
import { chatDb, LocalMessage, sanitizeMessage } from "./db";
import { countUnreadMessages } from "./chatUnread";
import { submitChatMessageBatch, chatDeliveryFailure } from "./chatDelivery";

// Concurrency guards for synchronization
const syncRegistry = new Map<string, Promise<any>>();
const listSyncRegistry = new Map<string, Promise<void>>();

/**
 * Generic helper to enqueue a story-related action for background synchronization.
 */
export const enqueueStoryAction = async (
  type: "story_view" | "story_like" | "story_unlike" | "story_message",
  payload: any,
) => {
  const id = crypto.randomUUID();
  await chatDb.sync_queue.put({
    id,
    type,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
    status: "pending",
  });
  processSyncQueue().catch(console.error);
};

export const syncConversation = async (conversationId: string) => {
  if (syncRegistry.has(conversationId)) {
    console.log(
      `[Sync] Sync already in-flight for ${conversationId}, joining existing promise.`,
    );
    return syncRegistry.get(conversationId);
  }

  const syncPromise = (async () => {
    try {
      console.log(
        `[Sync] Starting delta sync for conversation: ${conversationId}`,
      );

      const conv = await chatDb.conversations.get(conversationId);
      const lastSeq = conv?.last_seen_seq || 0;
      let safeMaxSeq = lastSeq;

      // 1. Parallelize all remote fetches
      const [
        { data: logData, error: msgError },
        { data: receipts, error: receiptError },
        { data: reactions, error: reactionError },
        { data: deletions, error: deletionError },
      ] = await Promise.all([
        // @ts-ignore
        (supabase.rpc as any)("sync_messages", {
          p_conversation_id: conversationId,
          p_after_seq: lastSeq,
        }),
        supabase
          .from("read_receipts" as any)
          .select("*")
          .eq("conversation_id", conversationId) as any,
        supabase
          .from("message_reactions" as any)
          .select(
            "id, message_id, user_id, emoji, created_at, messages!inner(conversation_id)",
          )
          .eq("messages.conversation_id", conversationId) as any,
        supabase
          .from("message_deletions")
          .select("message_id,messages!inner(conversation_id)")
          .eq("messages.conversation_id", conversationId),
      ]);

      if (msgError || receiptError || reactionError || deletionError) {
        throw msgError || receiptError || reactionError || deletionError;
      }

      // 2. Process Reactions (Strip join metadata)
      const reactionsToInsert =
        (reactions as any[])?.map((r) => {
          const { messages, ...reactionData } = r;
          return reactionData;
        }) || [];

      const messagesToInsert: LocalMessage[] = [];

      // 3. Process the messages
      if (logData) {
        for (const msg of logData) {
          const sanitized = sanitizeMessage({
            id: msg.id,
            conversation_id: msg.conversation_id,
            sender_id: String(msg.sender_id),
            content: msg.content,
            message_type: msg.message_type,
            attachment_url: msg.attachment_url,
            reply_to_id: msg.reply_to_id,
            forwarded_from_name: msg.forwarded_from_name,
            created_at: msg.created_at,
            updated_at: msg.updated_at,
            is_edited: msg.is_edited,
            deleted_for_everyone: msg.deleted_for_everyone,
            seq: Number(msg.seq),
            created_seq: Number(msg.created_seq ?? msg.seq),
            sync_status: "sent",
          });

          // Diagnostic check for dexie-encrypted fields (must not be undefined)
          for (const field of [
            "content",
            "attachment_url",
            "sender_id",
            "message_type",
            "reply_to_id",
            "forwarded_from_name",
          ]) {
            if ((sanitized as any)[field] === undefined) {
              console.error(
                `[Sync] CRITICAL: field "${field}" is undefined for message ${sanitized.id}. This will crash local DB.`,
              );
            }
          }

          messagesToInsert.push(sanitized);
        }
      }

      // 4. Batch write everything to Dexie in ONE atomic transaction
      await chatDb.transaction(
        "rw",
        chatDb.messages,
        chatDb.conversations,
        chatDb.read_receipts,
        chatDb.message_reactions,
        async () => {
          if (messagesToInsert.length > 0) {
            await chatDb.messages.bulkPut(messagesToInsert);
            const batchMax = Math.max(
              ...messagesToInsert.map((message) => message.seq || 0),
            );
            if (batchMax > safeMaxSeq) safeMaxSeq = batchMax;
          }

          // Update high-water mark
          await chatDb.conversations.put({
            id: conversationId,
            last_seen_seq: safeMaxSeq,
          });

          if (receipts && receipts.length > 0) {
            for (const receipt of receipts) {
              const current = await chatDb.read_receipts.get([
                receipt.conversation_id,
                receipt.user_id,
              ]);
              if (!current || receipt.last_read_seq > current.last_read_seq) {
                await chatDb.read_receipts.put({
                  user_id: receipt.user_id,
                  conversation_id: receipt.conversation_id,
                  last_read_seq: receipt.last_read_seq,
                  updated_at: receipt.updated_at,
                });
              }
            }
          }

          const messageIds = await chatDb.messages
            .where("conversation_id")
            .equals(conversationId)
            .primaryKeys();
          if (deletions?.length)
            await chatDb.messages.bulkDelete(
              deletions.map((row) => row.message_id),
            );
          if (messageIds.length)
            await chatDb.message_reactions
              .where("message_id")
              .anyOf(messageIds)
              .delete();
          if (reactionsToInsert.length > 0) {
            await chatDb.message_reactions.bulkPut(reactionsToInsert);
          }
        },
      );

      console.log(
        `[Sync] Conversation ${conversationId} synced. Cursor advanced to ${safeMaxSeq}`,
      );

      // Attempt to process queue after a successful sync
      processSyncQueue().catch(console.error);

      return messagesToInsert.length;
    } catch (err) {
      console.error("Error during chat sync:", err);
      throw err;
    } finally {
      syncRegistry.delete(conversationId);
    }
  })();

  syncRegistry.set(conversationId, syncPromise);
  return syncPromise;
};

/**
 * Synchronizes the conversation list metadata to Dexie for offline-first access.
 */
export const syncConversations = async (
  userId: string,
  freshAfterCurrent = false,
) => {
  if (listSyncRegistry.has(userId)) {
    if (freshAfterCurrent) {
      await listSyncRegistry.get(userId)?.catch(() => undefined);
      return syncConversations(userId);
    }
    return listSyncRegistry.get(userId);
  }

  const syncPromise = (async () => {
    try {
      console.log(`[Sync] Syncing conversation list for user: ${userId}`);
      const { data, error } = await supabase.rpc("get_user_conversations", {
        _user_id: userId,
      });

      if (error) {
        console.error("[Sync] Failed to fetch conversation list:", error);
        throw error;
      }

      if (data) {
        const receipts = await chatDb.read_receipts.toArray();
        const localReads = Object.fromEntries(
          receipts
            .filter((r) => r.user_id === userId)
            .map((r) => [r.conversation_id, r.last_read_seq]),
        );
        const { data: unreadRows, error: unreadError } = await (
          supabase.rpc as any
        )("get_chat_unread_counts", { p_local_reads: localReads });
        if (
          unreadError &&
          unreadError.code !== "PGRST202" &&
          unreadError.code !== "42883"
        )
          throw unreadError;
        const unreadMap = new Map<
          string,
          { unread_count: number; last_read_seq: number; latest_seq: number }
        >((unreadRows || []).map((row) => [row.conversation_id, row]));
        // Use a transaction to safely merge server data with local state
        await chatDb.transaction(
          "rw",
          chatDb.conversations_meta,
          chatDb.read_receipts,
          chatDb.sync_queue,
          chatDb.messages,
          async () => {
            const returnedIds = new Set(
              data.map((conversation) => conversation.conversation_id),
            );
            const removedIds = (await chatDb.conversations_meta.toArray())
              .filter(
                (conversation) =>
                  !returnedIds.has(conversation.conversation_id),
              )
              .map((conversation) => conversation.conversation_id);
            // The complete server list is authoritative. Remove stale local cards, never server membership/history.
            await chatDb.conversations_meta.bulkDelete(removedIds);
            for (const serverConv of data) {
              const localConv = await chatDb.conversations_meta.get(
                serverConv.conversation_id,
              );

              const stats = unreadMap.get(serverConv.conversation_id);
              const receipt = await chatDb.read_receipts.get([
                serverConv.conversation_id,
                userId,
              ]);
              const pending = await chatDb.sync_queue.get(
                `read_${serverConv.conversation_id}_${userId}`,
              );
              const readSeq = Math.max(
                receipt?.last_read_seq || 0,
                Number(stats?.last_read_seq || 0),
              );
              if (stats && readSeq > (receipt?.last_read_seq || 0)) {
                await chatDb.read_receipts.put({
                  conversation_id: serverConv.conversation_id,
                  user_id: userId,
                  last_read_seq: readSeq,
                  updated_at: new Date().toISOString(),
                });
              }
              const staleRead = stats
                ? readSeq > Number(stats.last_read_seq)
                : !!pending;
              const newerEvent =
                stats &&
                (localConv?.unread_latest_seq || 0) > Number(stats.latest_seq);
              const localRows = staleRead
                ? await chatDb.messages
                    .where("conversation_id")
                    .equals(serverConv.conversation_id)
                    .toArray()
                : [];
              await chatDb.conversations_meta.put({
                ...serverConv,
                ...(newerEvent && localConv
                  ? {
                      last_message: localConv.last_message,
                      last_message_at: localConv.last_message_at,
                      last_message_sender_id: localConv.last_message_sender_id,
                    }
                  : {}),
                unread_count: staleRead
                  ? countUnreadMessages(localRows, userId, readSeq)
                  : newerEvent
                    ? localConv.unread_count
                    : Number(stats?.unread_count ?? serverConv.unread_count),
                unread_read_seq: readSeq,
                unread_latest_seq: Math.max(
                  localConv?.unread_latest_seq || 0,
                  Number(stats?.latest_seq || 0),
                ),
              });
            }
          },
        );
      }
    } catch (err) {
      console.error("[Sync] Unexpected error during list sync:", err);
      throw err;
    } finally {
      listSyncRegistry.delete(userId);
    }
  })();

  listSyncRegistry.set(userId, syncPromise);
  return syncPromise;
};

/**
 * Synchronizes pinned conversations for a user.
 */
export const syncPinnedConversations = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("pinned_conversations" as any)
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;

    if (data) {
      await chatDb.pinned_conversations.clear();
      await chatDb.pinned_conversations.bulkPut(data as any[]);
    }
  } catch (err) {
    console.error("[Sync] Failed to sync pinned conversations:", err);
  }
};

/**
 * Toggles the pinned state of a conversation on both local DB and server.
 */
export const togglePinnedConversation = async (
  userId: string,
  conversationId: string,
  isPinned: boolean,
) => {
  // 1. Optimistic Update (Local DB)
  if (isPinned) {
    await chatDb.pinned_conversations.put({
      conversation_id: conversationId,
      user_id: userId,
      pinned_at: new Date().toISOString(),
    });
  } else {
    await chatDb.pinned_conversations.delete(conversationId);
  }

  // 2. Background Server Update
  (async () => {
    try {
      if (isPinned) {
        const { error } = await supabase
          .from("pinned_conversations" as any)
          .upsert({ user_id: userId, conversation_id: conversationId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pinned_conversations" as any)
          .delete()
          .match({ user_id: userId, conversation_id: conversationId });
        if (error) throw error;
      }
    } catch (err) {
      console.error("[Sync] Failed to toggle pin on server:", err);
      // Re-sync on failure to ensure consistency
      syncPinnedConversations(userId).catch(() => {});
    }
  })();
};

let queueRun: Promise<void> | null = null;
let queueRequested = false;

export function processSyncQueue(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return Promise.resolve();
  queueRequested = true;
  if (!queueRun) {
    queueRun = (async () => {
      do {
        queueRequested = false;
        await processSyncQueueBatch();
      } while (queueRequested);
    })().finally(() => {
      queueRun = null;
    });
  }
  return queueRun;
}

async function processSyncQueueBatch() {
  const queue = await chatDb.sync_queue.toArray();
  if (queue.length === 0) return;

  const MAX_RETRIES = 5;
  const BATCH_SIZE = 50;
  console.log(`[Sync] Processing sync queue (${queue.length} items)...`);

  // 1. Group items by type for batching
  const messageInserts = queue.filter(
    (item) => item.type === "message_insert" && item.retry_count < MAX_RETRIES,
  );
  const otherItems = queue.filter((item) => item.type !== "message_insert");

  // Preserve offline send order and isolate a revoked conversation from unrelated chats.
  const byConversation = new Map<string, typeof messageInserts>();
  for (const item of messageInserts.sort(
    (a, b) =>
      Date.parse(a.created_at) - Date.parse(b.created_at) ||
      a.id.localeCompare(b.id),
  )) {
    const key = item.payload.conversation_id;
    const items = byConversation.get(key) || [];
    items.push(item);
    byConversation.set(key, items);
  }
  const batches = [...byConversation.values()].flatMap((items) =>
    Array.from({ length: Math.ceil(items.length / BATCH_SIZE) }, (_, index) =>
      items.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
    ),
  );
  for (const batch of batches) {
    // SANITIZATION: Ensure UUID fields are null instead of "" for Supabase
    const payloads = batch.map((item) => ({
      ...item.payload,
      reply_to_id: item.payload.reply_to_id || null,
      attachment_url: item.payload.attachment_url || null,
    }));

    const batchIds = batch.map((item) => item.id);
    const messageIds = batch.map((item) => item.payload.id);

    try {
      // Mark batch as processing
      await chatDb.sync_queue
        .where("id")
        .anyOf(batchIds)
        .modify({ status: "processing" });
      const sendingMessages = await chatDb.messages
        .where("id")
        .anyOf(messageIds)
        .toArray();
      await chatDb.messages.bulkPut(
        sendingMessages.map((msg) => ({
          ...msg,
          sync_status: "sending" as const,
        })),
      );

      const accepted = await submitChatMessageBatch(supabase, payloads);

      // Atomic local cleanup for the whole batch
      await chatDb.transaction(
        "rw",
        chatDb.messages,
        chatDb.sync_queue,
        async () => {
          const msgsToUpdate = await chatDb.messages
            .where("id")
            .anyOf(messageIds)
            .toArray();
          for (const msg of msgsToUpdate) {
            msg.sync_status = "sent";
            const receipt = accepted.find((row) => row.id === msg.id)!;
            msg.seq = receipt.seq;
            msg.created_seq = receipt.created_seq;
            msg.created_at = receipt.created_at;
            msg.updated_at = receipt.updated_at;
            delete msg.sync_error;
            delete msg.sync_error_code;
          }
          await chatDb.messages.bulkPut(msgsToUpdate);
          await chatDb.sync_queue.bulkDelete(batchIds);
        },
      );

      console.log(`[Sync] Successfully batched ${batch.length} messages.`);
    } catch (err: any) {
      const failure = chatDeliveryFailure(err);
      console.error(
        `[Sync] Failed to process message batch starting with ${batch[0].id}:`,
        err,
      );

      // Bulk update retry counts and handle maximum retries
      await chatDb.transaction(
        "rw",
        chatDb.sync_queue,
        chatDb.messages,
        async () => {
          for (const item of batch) {
            const newRetryCount = (item.retry_count || 0) + 1;
            if (newRetryCount >= MAX_RETRIES) {
              // Stop automatic retries while retaining the exact durable payload for manual retry.
              const existingMsg = await chatDb.messages.get(item.payload.id);
              if (existingMsg) {
                existingMsg.sync_status = "failed";
                existingMsg.sync_error = failure.message;
                existingMsg.sync_error_code = failure.code;
                await chatDb.messages.put(existingMsg);
              }
              await chatDb.sync_queue.update(item.id, {
                status: "failed",
                retry_count: newRetryCount,
              });
            } else {
              const existingMsg = await chatDb.messages.get(item.payload.id);
              if (existingMsg)
                await chatDb.messages.put({
                  ...existingMsg,
                  sync_status: "failed",
                  sync_error: failure.message,
                  sync_error_code: failure.code,
                });
              // Incremental failure: update queue item
              await chatDb.sync_queue.update(item.id, {
                status: "pending",
                retry_count: newRetryCount,
              });
            }
          }
        },
      );

      if (err.code === "PGRST301") break; // Fatal auth
    }
  }

  // 3. Process other items individually (like read_receipts which are usually unique per heartbeat)
  for (const item of otherItems) {
    if (item.retry_count >= MAX_RETRIES) {
      await chatDb.sync_queue.delete(item.id);
      continue;
    }

    try {
      await chatDb.sync_queue.update(item.id, { status: "processing" });

      if (item.type === "read_receipt") {
        const { id, ...receiptPayload } = item.payload;
        const { error } = await supabase
          .from("read_receipts" as any)
          .upsert(receiptPayload, { onConflict: "conversation_id,user_id" });

        if (error) throw error;
        // A newer read may have replaced this entry while the request was in flight.
        await chatDb.transaction("rw", chatDb.sync_queue, async () => {
          const latest = await chatDb.sync_queue.get(item.id);
          if (
            latest &&
            latest.payload.last_read_seq <= item.payload.last_read_seq
          ) {
            await chatDb.sync_queue.delete(item.id);
          }
        });
      } else if (item.type === "story_view") {
        const { error } = await supabase
          .from("story_views")
          .insert(item.payload);
        if (error && error.code !== "23505") throw error; // Ignore duplicate views
        await chatDb.sync_queue.delete(item.id);
      } else if (item.type === "story_like") {
        const { error } = await supabase
          .from("story_likes")
          .insert(item.payload);
        if (error && error.code !== "23505") throw error; // Ignore duplicate likes
        await chatDb.sync_queue.delete(item.id);
      } else if (item.type === "story_unlike") {
        const { error } = await supabase
          .from("story_likes")
          .delete()
          .match(item.payload);
        if (error) throw error;
        await chatDb.sync_queue.delete(item.id);
      } else if (item.type === "story_message") {
        const { error } = await supabase
          .from("story_messages")
          .insert(item.payload);
        if (error) throw error;
        await chatDb.sync_queue.delete(item.id);
      }
      // Add other types here if needed (message_update, etc.)
    } catch (err: any) {
      console.error(`[Sync] Failed to process queue item ${item.id}:`, err);
      await chatDb.sync_queue.update(item.id, {
        status: "pending",
        retry_count: item.retry_count + 1,
      });
      if (err.code === "PGRST301") break;
    }
  }
}

export async function cleanupOldData() {
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - NINETY_DAYS_MS).toISOString();

  try {
    // Delete messages older than 90 days that are fully synced
    const oldMessages = await chatDb.messages
      .where("created_at")
      .below(cutoffDate)
      .and((msg) => msg.sync_status === "sent")
      .primaryKeys();

    if (oldMessages.length > 0) {
      await chatDb.messages.bulkDelete(oldMessages);
      console.log(
        `[Eviction] Cleared ${oldMessages.length} old synced messages to save storage.`,
      );
    }
  } catch (err) {
    console.error("[Eviction] Failed to cleanup old data:", err);
  }
}

let syncListenersRegistered = false;
export function registerSyncListeners() {
  if (typeof window === "undefined") return;
  if (syncListenersRegistered) return;
  syncListenersRegistered = true;
  // Resume durable pending messages after a reload, even when the browser was already online.
  processSyncQueue().catch(console.error);

  // Trigger sync queue when network comes back online
  window.addEventListener("online", () => {
    console.log("[Network] Back online, processing sync queue...");
    processSyncQueue().catch(console.error);
  });

  // Try to register Background Sync API if supported by Service Worker
  if ("serviceWorker" in navigator) {
    if ("SyncManager" in window) {
      navigator.serviceWorker.ready
        .then(async (registration: any) => {
          try {
            if (registration?.sync) {
              await registration.sync.register("chat-sync");
              console.log('[Background Sync] Registered "chat-sync".');
            }
          } catch (e) {
            // Expected when background sync is restricted or permission denied by the browser
            console.warn(
              "[Background Sync] Registration failed or not permitted.",
              e,
            );
          }
        })
        .catch((err) => {
          console.warn("[Background Sync] Service worker ready error:", err);
        });
    }

    // Listen for wake-up calls from the Service Worker
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "PROCESS_SYNC_QUEUE") {
        console.log(
          "[Background Sync] Service worker requested sync queue processing...",
        );
        processSyncQueue().catch(console.error);
      }
    });
  }

  // Run cleanup once on load
  cleanupOldData().catch(console.error);
}
