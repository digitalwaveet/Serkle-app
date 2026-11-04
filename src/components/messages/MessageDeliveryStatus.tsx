import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import { getMessageStatus } from '@/lib/messageStatus';

interface Props {
  syncStatus?: string;
  seq?: number;
  lastReadSeq?: number;
  onRetry: () => void;
  retrying?: boolean;
}

export default function MessageDeliveryStatus({ syncStatus, seq, lastReadSeq, onRetry, retrying }: Props) {
  const status = getMessageStatus(syncStatus, seq, lastReadSeq);
  if (status === 'failed') {
    return (
      <button type="button" disabled={retrying} aria-label="Message not sent. Retry sending"
        onClick={event => { event.stopPropagation(); onRetry(); }}
        className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
        <span>Retry</span>
      </button>
    );
  }
  const label = { pending: 'Queued', sending: 'Sending', sent: 'Sent', read: 'Read' }[status];
  const Icon = status === 'read' ? CheckCheck : status === 'sent' ? Check : Clock;
  return (
    <span role="img" aria-label={label} title={label} className={status === 'read' ? 'text-primary' : 'text-muted-foreground'}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
    </span>
  );
}
