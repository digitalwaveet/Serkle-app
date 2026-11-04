import { useRef, useState } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CIRCLE_LEAVE_SUBSCRIPTION_NOTICE } from '@/lib/circleLeave';

export function LeaveCircleDialog({ open, onOpenChange, circleName, isPrivate, subscriptionRequired, canLeave, onConfirm, onLeft }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circleName: string;
  isPrivate: boolean;
  subscriptionRequired: boolean;
  canLeave: boolean;
  onConfirm: () => Promise<unknown>;
  onLeft: () => void;
}) {
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changeOpen = (value: boolean) => {
    if (submitting.current) return;
    setError('');
    onOpenChange(value);
  };
  const confirm = async () => {
    if (submitting.current || !canLeave) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not confirm leaving. Check your connection and retry.');
      return;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
    onOpenChange(false);
    onLeft();
  };
  return <AlertDialog open={open} onOpenChange={changeOpen}>
    <AlertDialogContent className="max-w-[400px]" onEscapeKeyDown={event => { if (submitting.current) event.preventDefault(); }} aria-busy={busy}>
      <AlertDialogHeader>
        <AlertDialogTitle>Leave {circleName}?</AlertDialogTitle>
        <AlertDialogDescription>
          Your Circle membership will end and the Circle will be removed from Joined.
          {isPrivate ? ' Rejoining this private Circle requires approval.' : ' You can request to join again later.'}
          {subscriptionRequired && ' Rejoining requires an active subscription.'}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <p className="text-sm text-muted-foreground">{CIRCLE_LEAVE_SUBSCRIPTION_NOTICE}</p>
      {!canLeave && !busy && <p role="alert" className="text-sm text-destructive">Your membership has changed. Refresh the Circle before leaving. Owners must transfer ownership or explicitly delete their Circle.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Stay</AlertDialogCancel>
        <Button variant="destructive" disabled={busy || !canLeave} onClick={confirm} aria-busy={busy}>
          {busy ? 'Leaving…' : 'Leave Circle'}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
