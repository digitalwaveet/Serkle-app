import { useEffect, useRef, useState, type RefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionErrorMessage } from '@/lib/edgeFunctionError';
import { PAYMENT_REVIEW_REASONS, paymentCheckLabel, suggestedPaymentReview, type PaymentDiagnostics, type PaymentReviewReason } from '@/lib/paymentReview';
import { walletDate, walletEventLabels, walletSourceLabels } from '@/lib/walletHistory';

type Target = { id: string; tx_ref: string };
type Draft = { reason: PaymentReviewReason; message: string; requestId: string; status: 'pending' | 'failed' };

export function AdminPaymentReviewDialog({ target, userId, onClose, returnFocusRef }: {
  target: Target;
  userId: string;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement>;
}) {
  const client = useQueryClient();
  const queryKey = ['admin', 'payment-diagnostics', userId, target.id] as const;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);
  const diagnostics = useQuery({
    queryKey, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_admin_payment_diagnostics', { _payment_id: target.id }).abortSignal(signal);
      if (error) throw error;
      const result = data as unknown as PaymentDiagnostics;
      if (!result?.status || !Array.isArray(result.events)) throw new Error('Invalid payment details.');
      return result;
    },
  });
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey }),
    client.invalidateQueries({ queryKey: ['admin', 'wallet-operations', userId] }),
  ]);
  const check = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('chapa-admin', { body: { action: 'check_payment', reference: target.tx_ref } });
      if (error) throw new Error(await edgeFunctionErrorMessage(error));
      if (data?.reference !== target.tx_ref || !data?.status) throw new Error('The check could not be confirmed.');
    },
    onSuccess: () => toast.success('Payment status refreshed.'),
    onError: (error) => setErrorMessage(error.message),
    onSettled: () => Promise.all([
      refresh(),
      client.invalidateQueries({ queryKey: ['admin', 'coin-holdings', userId] }),
    ]),
  });
  const send = useMutation({
    mutationFn: async (value: Draft) => {
      const { data, error } = await supabase.rpc('send_wallet_payment_review', {
        _payment_id: target.id, _request_id: value.requestId, _expected_status: value.status,
        _reason: value.reason, _message: value.message.trim(),
      });
      if (error) throw error;
      if (!data || typeof data !== 'object' || !('sent_at' in data) || !data.sent_at) throw new Error('Could not confirm delivery. Retry this review.');
    },
    onSuccess: async () => {
      setDraft(null);
      toast.success('Review sent to Wallet and Notifications.');
      await refresh();
      closeButton.current?.focus();
    },
    onError: (error) => setErrorMessage(error.message),
  });
  const data = diagnostics.data;
  const busy = check.isPending || send.isPending;
  const canSend = data?.mode === 'live' && (data.status === 'pending' || data.status === 'failed');
  useEffect(() => {
    if (draft && data && !send.isPending && (draft.status !== data.status || !canSend)) {
      setDraft(null);
      setErrorMessage('The payment status changed. Review the updated details before sending a message.');
    }
  }, [data, draft, canSend, send.isPending]);

  const startDraft = () => {
    if (!canSend) return;
    const reason = suggestedPaymentReview(data);
    setErrorMessage('');
    setDraft({ reason, message: PAYMENT_REVIEW_REASONS[reason].message, requestId: crypto.randomUUID(), status: data.status as Draft['status'] });
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
        onCloseAutoFocus={event => { event.preventDefault(); returnFocusRef.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>Review Chapa payment</DialogTitle>
          <DialogDescription className="break-all">Reference {target.tx_ref}</DialogDescription>
        </DialogHeader>
        {diagnostics.isPending && <p role="status" className="text-sm text-muted-foreground">Loading payment evidence…</p>}
        {diagnostics.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          <span>Could not load payment evidence.</span><Button variant="outline" onClick={() => void diagnostics.refetch()}>Retry</Button>
        </div>}
        {data && <>
          <dl className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Recorded status</dt><dd className="capitalize">{data.status}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Last verified Chapa outcome</dt><dd className="capitalize">{data.provider_outcome || (data.verified_at && data.provider_status) || 'Unconfirmed'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Last provider verification</dt><dd>{walletDate(data.verified_at)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Chapa receipt reference</dt><dd className="break-all">{data.provider_reference || 'Unavailable'}</dd></div>
            {data.kind === 'topup' && <>
              <div><dt className="text-xs text-muted-foreground">Checkout link</dt><dd>{data.checkout_state === 'ready' ? 'Prepared' : data.checkout_state === 'processing' ? 'Preparation started' : 'Unconfirmed'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Serkle return page seen</dt><dd>{data.checkout_return_seen_at ? walletDate(data.checkout_return_seen_at) : 'No visit recorded'}</dd></div>
            </>}
            {data.last_error_code && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Latest check issue</dt><dd>{paymentCheckLabel(data.last_error_code)}</dd></div>}
            {data.review_code && data.review_code !== data.last_error_code && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Earlier review flag</dt><dd>{paymentCheckLabel(data.review_code)}</dd></div>}
          </dl>
          {data.kind === 'topup' && <p className="text-sm text-muted-foreground">A missing return visit cannot tell us whether someone closed the Chapa page, left checkout, or lost their connection.</p>}
          {data.events.length > 0 && <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Recent payment evidence</summary>
            <ol className="mt-2 divide-y">{data.events.map(event => <li key={event.id} className="py-2">
              <p>{event.error_code ? paymentCheckLabel(event.error_code) : walletEventLabels[event.event_type] || 'Payment check'}</p>
              <p className="text-xs text-muted-foreground">{walletDate(event.created_at)} · {walletSourceLabels[event.source] || 'Server'} · {event.status}</p>
            </li>)}</ol>
          </details>}
          {data.latest_review && <section className="rounded-lg border p-3 text-sm" aria-label="Last review sent">
            <p className="font-medium">Last review sent</p>
            <p className="text-xs text-muted-foreground">{walletDate(data.latest_review.created_at)}</p>
            <p className="mt-2 whitespace-pre-wrap break-words">{data.latest_review.message}</p>
          </section>}
          {draft && canSend && <form className="space-y-3 rounded-lg border p-3" onSubmit={(event) => {
            event.preventDefault();
            if (!busy && draft.message.trim().length >= 10) { setErrorMessage(''); send.mutate(draft); }
          }}>
            <div className="space-y-1">
              <Label htmlFor="payment-review-reason">Reason</Label>
              <Select value={draft.reason} onValueChange={(value: PaymentReviewReason) => setDraft({
                ...draft, reason: value, message: PAYMENT_REVIEW_REASONS[value].message, requestId: crypto.randomUUID(),
              })} disabled={busy}>
                <SelectTrigger id="payment-review-reason"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[160]">{Object.entries(PAYMENT_REVIEW_REASONS).map(([value, choice]) =>
                  <SelectItem key={value} value={value}>{choice.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment-review-message">Message to the user</Label>
              <Textarea id="payment-review-message" value={draft.message} maxLength={1500} rows={5} disabled={busy}
                onChange={event => setDraft({ ...draft, message: event.target.value, requestId: crypto.randomUUID() })} />
              <p className="text-xs text-muted-foreground">This exact message appears on the Wallet receipt and in Notifications. Keep out bank details, credentials, and internal notes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setDraft(null); setErrorMessage(''); }}>Cancel message</Button>
              <Button type="submit" disabled={busy || draft.message.trim().length < 10}>{send.isPending ? 'Sending…' : 'Send review message'}</Button>
            </div>
          </form>}
          {!canSend && <p className="text-sm text-muted-foreground">{data.mode === 'test' ? 'Test payments cannot send customer notices.' : 'This payment is outside the unsettled review workflow.'}</p>}
        </>}
        {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
        <DialogFooter>
          <Button ref={closeButton} variant="outline" disabled={busy} onClick={onClose}>Done</Button>
          {data && <Button variant="outline" disabled={busy} onClick={() => { setErrorMessage(''); check.mutate(); }}>
            <RefreshCw className="mr-1.5 size-4" aria-hidden="true" />{check.isPending ? 'Checking…' : 'Check with Chapa'}
          </Button>}
          {!draft && canSend && <Button disabled={busy || diagnostics.isError} onClick={startDraft}>Write review message</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
