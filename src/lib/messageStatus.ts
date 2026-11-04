export type MessageStatus = 'pending' | 'sending' | 'sent' | 'read' | 'failed';

// A server sequence proves acceptance, not delivery to another device.
export function getMessageStatus(syncStatus: string | undefined, seq?: number, lastReadSeq = 0): MessageStatus {
  if (syncStatus === 'pending' || syncStatus === 'sending' || syncStatus === 'failed') return syncStatus;
  if (seq && lastReadSeq >= seq) return 'read';
  return 'sent';
}

export function isActiveMute(record: { muted_until: string | null } | null | undefined, now = Date.now()): boolean {
  return !!record && (record.muted_until === null || Date.parse(record.muted_until) > now);
}
