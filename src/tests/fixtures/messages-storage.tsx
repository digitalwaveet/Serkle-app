import { useEffect, useState } from "react";
import {
  useSendMessage,
  useRetryMessage,
} from "@/hooks/useMessages.ts?messaging-actual";
import { useUnreadCount } from "@/hooks/useUnreadCount.ts?messaging-actual";
import { chatDb, sanitizeMessage } from "@/lib/db";
import {
  syncConversation,
  processSyncQueue,
} from "@/lib/sync.ts?messaging-actual";
export default function StorageFixture() {
  const send = useSendMessage(),
    retry = useRetryMessage(),
    unread = useUnreadCount(),
    [ready, setReady] = useState(false);
  useEffect(() => {
    localStorage.setItem("SERKLE_DB_ENCRYPTION_VERSION", "v6_premium_profile");
    void chatDb
      .initEncryption("isolated-messaging-test-session")
      .then(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!ready) return;
    (window as any).messagingStorage = {
      send: send.sendMessageAsync,
      flush: processSyncQueue,
      retry: retry.mutateAsync,
      failNextCacheWrite() {
        const original = chatDb.messages.bulkPut.bind(chatDb.messages);
        let fail = true;
        chatDb.messages.bulkPut = ((...args: any[]) => {
          if (fail) {
            fail = false;
            return Promise.reject(
              new Error("Simulated local storage quota failure"),
            );
          }
          return (original as any)(...args);
        }) as any;
      },
      unread: () => unread.totalUnreadCount,
      async seedReaction() {
        const { me, dm } = (window as any).messagesFixture;
        await chatDb.messages.put(
          sanitizeMessage({
            id: "reaction-message",
            conversation_id: dm,
            sender_id: me,
            content: "React here",
            created_at: "2026-11-07T07:00:00Z",
            seq: 1,
          }),
        );
        await chatDb.message_reactions.put({
          id: "reaction",
          message_id: "reaction-message",
          user_id: me,
          emoji: "❤️",
          created_at: "2026-11-07T07:00:00Z",
        });
      },
      sync: () => syncConversation((window as any).messagesFixture.dm),
      reactions: () => chatDb.message_reactions.toArray(),
      async seedUnread() {
        const { me, dm, friend } = (window as any).messagesFixture;
        await chatDb.conversations_meta.put({
          conversation_id: dm,
          unread_count: 2,
          unread_read_seq: 0,
          last_message_sender_id: me,
        } as any);
        await chatDb.messages.bulkPut([
          sanitizeMessage({
            id: "incoming-1",
            conversation_id: dm,
            sender_id: friend,
            content: "First",
            seq: 1,
            created_seq: 1,
            created_at: "2026-11-07T07:00:00Z",
          }),
          sanitizeMessage({
            id: "incoming-2",
            conversation_id: dm,
            sender_id: friend,
            content: "Second",
            seq: 2,
            created_seq: 2,
            created_at: "2026-11-07T07:01:00Z",
          }),
          sanitizeMessage({
            id: "own-latest",
            conversation_id: dm,
            sender_id: me,
            content: "My reply",
            seq: 3,
            created_seq: 3,
            created_at: "2026-11-07T07:02:00Z",
          }),
        ]);
      },
      async read() {
        const { me, dm } = (window as any).messagesFixture;
        await chatDb.transaction(
          "rw",
          chatDb.read_receipts,
          chatDb.sync_queue,
          async () => {
            await chatDb.read_receipts.put({
              conversation_id: dm,
              user_id: me,
              last_read_seq: 3,
              updated_at: new Date().toISOString(),
            });
            await chatDb.sync_queue.put({
              id: `read_${dm}_${me}`,
              type: "read_receipt",
              payload: {},
              created_at: new Date().toISOString(),
              retry_count: 0,
              status: "pending",
            });
          },
        );
      },
      snapshot: async () => ({
        conversations: await chatDb.conversations.toArray(),
        messages: await chatDb.messages.toArray(),
        queue: await chatDb.sync_queue.toArray(),
      }),
    };
  }, [ready, send.sendMessageAsync, unread]);
  return (
    <main>
      <h1>Isolated messaging storage</h1>
      <p role="status">{ready ? "Storage ready" : "Preparing storage"}</p>
      <p data-testid="storage-unread">
        {unread.isLoading ? "Loading" : unread.totalUnreadCount}
      </p>
    </main>
  );
}
