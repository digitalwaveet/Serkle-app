import { supabase } from '@/integrations/supabase/client';

// Keep the key after uncertain network failures. Retrying the same explicit
// purchase after a reload must not create another debit.
export async function purchaseCircleAccess(kind: 'subscription' | 'post' | 'video', targetId: string, options: { expectedPrice: number; renew?: boolean; expectedExpiresAt?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please log in to purchase');
  const key = `circle-payment:${user.id}:${kind}:${targetId}:${options?.renew ? options.expectedExpiresAt : 'purchase'}`;
  let requestId = localStorage.getItem(key);
  if (!requestId) { requestId = crypto.randomUUID(); localStorage.setItem(key, requestId); }
  const { data, error } = await supabase.rpc('purchase_circle_access' as any, {
    _expected_price: options.expectedPrice, _kind: kind, _target_id: targetId, _request_id: requestId,
    _renew: options?.renew ?? false, _expected_expires_at: options?.expectedExpiresAt ?? null,
  });
  if (error) throw error;
  const result = data as any;
  if (result?.refunded || !result?.has_access) {
    // A confirmed refund/expiry needs a new, explicit purchase attempt.
    localStorage.removeItem(key);
    throw new Error('This purchase is no longer active. Review the price and try again.');
  }
  localStorage.removeItem(key);
  return result as { charged: number; replayed: boolean; expires_at?: string };
}

export const CIRCLE_ACCESS_QUERY_KEYS = ['circle-subscription', 'circle-posts', 'circle-post', 'circle-videos', 'circle-resources', 'coin-wallet', 'coin-transactions', 'circle', 'circles', 'circles-search', 'my-circles', 'owned-circles', 'circle-invite-preview'];

export async function purchaseCircleBooking(kind: 'event' | 'service', targetId: string, expectedPrice: number, details: Record<string, string> = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please log in to purchase');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(details)));
  const fingerprint = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  const key = `circle-booking:${user.id}:${kind}:${targetId}:${fingerprint}`;
  let requestId = localStorage.getItem(key);
  if (!requestId) { requestId = crypto.randomUUID(); localStorage.setItem(key, requestId); }
  const { data, error } = await supabase.rpc('purchase_circle_booking' as any, { _kind: kind, _target_id: targetId, _request_id: requestId, _expected_price: expectedPrice, _details: details });
  if (error) throw error;
  const result = data as any;
  localStorage.removeItem(key);
  if (result?.refunded) throw new Error('This booking was refunded. Review the price before booking again.');
  return result;
}
