export type WalletMode = 'all' | 'live' | 'test';
export interface WalletCursor { created_at: string; id: string }
export interface WalletPayment {
  id: string; tx_ref: string; amount: number; currency: string; mode: 'live' | 'test';
  status: 'pending' | 'failed' | 'succeeded' | 'refunded' | 'reversed';
  checkout_state: string; created_at: string; verified_at: string | null;
  next_check_at: string; credited_at: string | null; reversed_at: string | null;
  check_count: number; last_error: string | null; last_error_code: string | null;
  review_required: boolean; provider_status: string | null; provider_reference: string | null;
  payment_method: string | null; provider_fee: number | null;
  kind: 'topup' | 'withdrawal'; reserved_at?: string | null; restored_at?: string | null; submitted_at?: string | null; destination_hint?: string | null;
}
export interface WalletAuditEvent extends WalletCursor {
  event_type: string; source: string; status: string; previous_status: string | null;
  message: string | null; details: Record<string, unknown>;
}
export function walletPage<T extends WalletCursor>(rows: T[], size: number) {
  const items = rows.slice(0, size);
  const last = items[items.length - 1];
  return { items, next: rows.length > size && last ? { created_at: last.created_at, id: last.id } : undefined };
}
export function walletPaymentStatus(payment: WalletPayment) {
  if (payment.review_required) return 'Needs review';
  if (payment.kind === 'withdrawal') {
    if (payment.restored_at) return 'Reserved coins returned';
    if (payment.status === 'succeeded') return payment.mode === 'test' ? 'Test withdrawal successful' : 'Withdrawal completed';
    if (payment.status === 'failed') return payment.submitted_at ? 'Withdrawal failed at last check' : 'Payout not submitted';
    return payment.submitted_at ? 'Withdrawal awaiting confirmation' : 'Withdrawal being prepared';
  }
  if (payment.reversed_at || ['refunded', 'reversed'].includes(payment.status)) return payment.status === 'reversed' ? 'Reversed' : 'Refunded';
  if (payment.mode === 'test' && payment.status === 'succeeded') return 'Test successful';
  if (payment.mode === 'live' && payment.status === 'succeeded' && payment.credited_at) return 'Completed';
  if (payment.provider_status === 'succeeded' && !payment.credited_at) return 'Wallet update pending';
  if (payment.status === 'failed') return 'Failed at last check';
  if (payment.checkout_state === 'error') return 'Checkout unconfirmed';
  return 'Awaiting confirmation';
}
export function walletDate(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'long' }).format(timestamp) : 'Not available';
}
export function walletMoney(amount: number, currency = 'ETB') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}
export function walletPaymentTone(payment: WalletPayment): 'success' | 'danger' | 'test' | 'pending' | 'neutral' {
  const label=walletPaymentStatus(payment);
  if(['Needs review','Failed at last check','Withdrawal failed at last check','Payout not submitted'].includes(label)) return 'danger';
  if(['Completed','Withdrawal completed'].includes(label)) return 'success';
  if(['Test successful','Test withdrawal successful'].includes(label)) return 'test';
  if(['Refunded','Reversed','Reserved coins returned'].includes(label)) return 'neutral';
  return 'pending';
}
export function walletShortDate(value: string) {
  const timestamp=Date.parse(value);
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(timestamp) : 'Date unavailable';
}
export const walletEventLabels: Record<string, string> = {
  created: 'Payment reference recorded', history_imported: 'Existing receipt imported',
  checkout_processing: 'Checkout requested', checkout_ready: 'Checkout ready', checkout_error: 'Checkout not confirmed',
  check_started: 'Status check started', verified: 'Provider status verified', check_error: 'Status check needs another attempt',
  status_changed: 'Payment status updated',
  check_unchanged: 'Status unchanged',
  funds_reserved: 'Coins reserved for withdrawal', funds_restored: 'Reserved coins returned',
  payout_submission_started: 'Payout submission started',
  review_required: 'Receipt flagged for review', review_resolved: 'Receipt review completed',
};
export const walletSourceLabels: Record<string, string> = {
  initialize: 'Checkout', user: 'Manual check', webhook: 'Chapa notification',
  scheduled: 'Automatic server check', reconcile: 'Background check', server: 'Server', migration: 'Existing record',
};
