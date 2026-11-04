import { useLiveQuery } from 'dexie-react-hooks';
import { chatDb } from '@/lib/db';
import { useUser } from '@/contexts/UserContext';
import { countUnreadMessages, reconcileUnreadCount } from '@/lib/chatUnread';

export const useUnreadCount = () => {
  const { user } = useUser();
  const userId = user?.id;
  const unreadData = useLiveQuery(async () => {
    const counts = new Map<string, number>();
    if (!userId) return { counts, total: 0 };
    const metas = await chatDb.conversations_meta.toArray();
    await Promise.all(metas.map(async meta => {
      const [receipt, pending, messages] = await Promise.all([
        chatDb.read_receipts.get([meta.conversation_id, userId]),
        chatDb.sync_queue.get(`read_${meta.conversation_id}_${userId}`),
        chatDb.messages.where('conversation_id').equals(meta.conversation_id).toArray(),
      ]);
      const readSeq = receipt?.last_read_seq || 0;
      const localCount = countUnreadMessages(messages, userId, readSeq);
      const count = reconcileUnreadCount(localCount, meta.unread_count, readSeq, meta.unread_read_seq, !!pending);
      if (count > 0) counts.set(meta.conversation_id, count);
    }));
    return { counts, total: [...counts.values()].reduce((sum, count) => sum + count, 0) };
  }, [userId]);
  const totalUnreadCount = unreadData?.total || 0;
  return {
    totalUnreadCount,
    getUnreadCountForConversation: (id: string) => unreadData?.counts.get(id) || 0,
    hasUnread: totalUnreadCount > 0,
  };
};
