export const PAYMENT_REVIEW_REASONS = {
  provider_failed: { label: 'Chapa reported a failure', message: 'Chapa reported that this payment attempt failed. If your payment provider shows a debit, keep the receipt and contact Serkle support with the transaction reference.' },
  provider_cancelled: { label: 'Chapa reported a cancellation', message: 'Chapa reported this payment attempt as cancelled. If your payment provider shows a debit, keep the receipt and contact Serkle support with the transaction reference.' },
  provider_timeout: { label: 'Request to Chapa timed out', message: 'Our request to Chapa timed out, so we could not confirm the outcome. Check this receipt again before starting another payment.' },
  checkout_unconfirmed: { label: 'Checkout completion unconfirmed', message: 'We have no confirmation that checkout completed. If your payment provider shows a debit, keep the receipt and contact Serkle support before trying again.' },
  provider_unavailable: { label: 'Chapa verification unavailable', message: 'We could not get a reliable verification response from Chapa. Please check this receipt again before starting another payment.' },
  details_mismatch: { label: 'Provider details need verification', message: 'The details returned by Chapa could not be matched to this receipt. Please contact Serkle support with your transaction reference and any payment receipt.' },
  wallet_processing: { label: 'Serkle wallet update incomplete', message: 'The wallet update could not finish. Please check this receipt again before starting another payment.' },
  still_pending: { label: 'Payment still awaiting confirmation', message: 'This payment is still awaiting confirmation. Check this receipt again before starting another payment.' },
  unknown: { label: 'Cause could not be confirmed', message: 'We reviewed the receipt and could not confirm the reason this payment has not settled. If you were debited, keep your payment receipt and contact Serkle support before retrying.' },
} as const;

export type PaymentReviewReason = keyof typeof PAYMENT_REVIEW_REASONS;
export const paymentReviewReasonLabel = (reason: unknown) =>
  typeof reason === 'string' && Object.prototype.hasOwnProperty.call(PAYMENT_REVIEW_REASONS, reason)
    ? PAYMENT_REVIEW_REASONS[reason as PaymentReviewReason].label
    : null;
export interface PaymentReviewMessage {
  created_at: string;
  reason: PaymentReviewReason;
  message: string;
}
export interface PaymentDiagnostics {
  status: 'pending' | 'failed' | 'succeeded' | 'refunded' | 'reversed';
  mode: 'live' | 'test';
  kind: 'topup' | 'withdrawal';
  verified_at: string | null;
  checkout_state: string | null;
  checkout_return_seen_at: string | null;
  provider_status: string | null;
  provider_outcome: string | null;
  provider_reference: string | null;
  last_error_code: string | null;
  review_code: string | null;
  events: { id: string; created_at: string; event_type: string; source: string; status: string; error_code: string | null }[];
  latest_review: PaymentReviewMessage | null;
}

const checkErrors: Partial<Record<string, PaymentReviewReason>> = {
  provider_timeout: 'provider_timeout',
  provider_unavailable: 'provider_unavailable',
  environment_unavailable: 'provider_unavailable',
  checkout_unconfirmed: 'checkout_unconfirmed',
  provider_not_paid: 'checkout_unconfirmed',
  verification_mismatch: 'details_mismatch',
  provider_state_unknown: 'details_mismatch',
  withdrawal_state_conflict: 'details_mismatch',
  fulfillment_error: 'wallet_processing',
  notification_pending: 'still_pending',
};

export const paymentCheckLabel = (code: string | null) => {
  if (code === 'provider_not_paid') return 'Chapa reported unpaid at the last check';
  if (code === 'provider_state_unknown') return 'Chapa returned an unrecognized status or timestamp';
  if (code === 'withdrawal_state_conflict') return 'Chapa reported a status that conflicts with the earlier withdrawal outcome';
  if (code === 'environment_unavailable') return 'Verification is unavailable for this payment mode';
  const reason = code && checkErrors[code];
  return reason ? PAYMENT_REVIEW_REASONS[reason].label : 'No specific cause recorded';
};

export function suggestedPaymentReview(data: PaymentDiagnostics): PaymentReviewReason {
  if (data.review_code && checkErrors[data.review_code]) return checkErrors[data.review_code]!;
  if (data.provider_outcome === 'cancelled' || data.provider_outcome === 'canceled') return 'provider_cancelled';
  if (data.provider_outcome === 'failed' || (data.provider_status === 'failed' && data.verified_at)) return 'provider_failed';
  if (data.last_error_code && checkErrors[data.last_error_code]) return checkErrors[data.last_error_code]!;
  if (data.kind === 'topup' && (data.checkout_state === 'error' || (data.status === 'pending' && !data.checkout_return_seen_at && !data.verified_at))) return 'checkout_unconfirmed';
  return data.status === 'pending' ? 'still_pending' : 'unknown';
}
