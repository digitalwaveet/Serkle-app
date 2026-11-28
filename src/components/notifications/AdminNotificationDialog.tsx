import type { RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ShieldCheck, X } from 'lucide-react';
import type { NotificationPanelEntry } from '@/lib/notificationPanelEntries';
import { paymentReviewReasonLabel } from '@/lib/paymentReview';

export const isAdminNotification = (type: unknown) => typeof type === 'string' && type.startsWith('admin_');

export function AdminNotificationDialog({ entry, onClose, returnFocus, fallbackFocus }: {
  entry: NotificationPanelEntry;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement>;
  fallbackFocus: RefObject<HTMLElement>;
}) {
  const date = entry.notification.sent_at || entry.notification.created_at;
  const isPaymentReview = entry.notification.notification_type === 'admin_payment_review';
  const reason = isPaymentReview ? paymentReviewReasonLabel(entry.notification.data?.reason) : null;
  const reference = isPaymentReview && typeof entry.notification.data?.paymentReference === 'string'
    ? entry.notification.data.paymentReference : null;
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="notification-preferences-overlay" />
        <Dialog.Content className="notification-ui notification-preferences" onCloseAutoFocus={(event) => {
          const target = returnFocus.current?.isConnected ? returnFocus.current : fallbackFocus.current;
          if (target?.isConnected) { event.preventDefault(); target.focus(); }
        }}>
          <header className="notification-preferences-header min-w-0">
            <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="break-words">{entry.title}</Dialog.Title>
              <Dialog.Description>Message from the Serkle team</Dialog.Description>
            </div>
            <Dialog.Close className="notification-icon-button shrink-0" aria-label="Close message"><X aria-hidden="true" /></Dialog.Close>
          </header>
          <div className="notification-preferences-body space-y-3">
            {date && Number.isFinite(Date.parse(date)) && <time dateTime={date} className="text-xs text-muted-foreground">{new Date(date).toLocaleString()}</time>}
            {reason && <p className="text-sm font-semibold">{reason}</p>}
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.body || 'No additional details were included.'}</p>
            {reference && <p className="break-all text-xs text-muted-foreground">Payment reference <span className="font-mono">{reference}</span></p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
