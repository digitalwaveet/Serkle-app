export interface UnreadMessage {
  sender_id: string;
  seq?: number;
  created_seq?: number;
  deleted_for_everyone?: boolean;
}

// Sequences are cursors, not counts. Count actual incoming, non-deleted rows.
export function countUnreadMessages(messages: UnreadMessage[], userId: string, lastReadSeq: number): number {
  return messages.filter(message => message.sender_id !== userId && !message.deleted_for_everyone
    && (message.created_seq ?? message.seq ?? 0) > lastReadSeq).length;
}

export function reconcileUnreadCount(localCount: number, cachedCount: number, localReadSeq: number, countedReadSeq: number | undefined, pendingRead: boolean): number {
  if (pendingRead || (countedReadSeq !== undefined && localReadSeq > countedReadSeq)) return localCount;
  if (countedReadSeq !== undefined) return Math.max(0, cachedCount || 0);
  return Math.max(localCount, cachedCount || 0);
}
