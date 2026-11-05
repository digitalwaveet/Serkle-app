import assert from 'node:assert/strict';
import { test } from 'node:test';
import { walletDate, walletPage, walletPaymentStatus, type WalletPayment } from '../lib/walletHistory.ts';
import { chapaRequestKey, parseWalletAmount, recordTopUpResult, withdrawalRequestKey, withdrawalReferenceKey, writeChapaStorage, readChapaStorage } from '../lib/chapaPayments.ts';

const payment = (patch: Partial<WalletPayment> = {}) => ({ kind: 'topup', mode: 'live', status: 'pending', checkout_state: 'ready', credited_at: null, reversed_at: null, review_required: false, ...patch } as WalletPayment);
test('receipt labels distinguish test success, recorded credit, pending fulfillment and restored withdrawals', () => {
  assert.equal(walletPaymentStatus(payment()), 'Awaiting confirmation');
  assert.equal(walletPaymentStatus(payment({ mode: 'test', status: 'succeeded' })), 'Test successful');
  assert.equal(walletPaymentStatus(payment({ status: 'succeeded' })), 'Awaiting confirmation');
  assert.equal(walletPaymentStatus(payment({ status: 'succeeded', credited_at: '2026-11-05T10:00:00Z' })), 'Completed');
  assert.equal(walletPaymentStatus(payment({ provider_status: 'succeeded' })), 'Wallet update pending');
  assert.equal(walletPaymentStatus(payment({ review_required: true })), 'Needs review');
  assert.equal(walletPaymentStatus(payment({ kind: 'withdrawal', restored_at: '2026-11-05T10:00:00Z', status: 'failed' })), 'Reserved coins returned');
  assert.equal(walletPaymentStatus(payment({ kind: 'withdrawal', status: 'succeeded', mode: 'test' })), 'Test withdrawal successful');
});
test('wallet amount inputs reject fractions, exponent notation and out-of-range amounts without silently rounding', () => {
  for (const amount of ['10', '500', '1000000']) assert.equal(parseWalletAmount(amount), Number(amount));
  for (const amount of ['', '9', '10.5', '-10', '1e3', '1000001', '20bad']) assert.equal(parseWalletAmount(amount), 0);
});
test('history cursor uses the last visible row and does not consume the extra lookahead record', () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({ id: String(index), created_at: '2026-11-05T10:00:00Z' }));
  const page = walletPage(rows, 20);
  assert.equal(page.items.length, 20);assert.deepEqual(page.next, rows[19]);assert.equal(walletPage(rows.slice(0, 20), 20).next, undefined);
});
test('timestamps with different timezone offsets display the same instant and unknown timestamps stay neutral', () => {
  assert.equal(walletDate('2026-11-05T13:00:00+03:00'), walletDate('2026-11-05T10:00:00Z'));
  assert.equal(walletDate(null), 'Not available');assert.equal(walletDate('invalid'), 'Not available');
});
test('test/live initialization IDs are separate and a late withdrawal response cannot clear a newer request', () => {
  assert.notEqual(chapaRequestKey('buyer', 500, 'test'), chapaRequestKey('buyer', 500, 'live'));
  const key = withdrawalRequestKey('buyer', 'fingerprint', 'live'), refKey = withdrawalReferenceKey('buyer', 'old-receipt');
  writeChapaStorage(key, 'new-request');writeChapaStorage(refKey, key);
  recordTopUpResult('buyer', { userId: 'buyer', status: 'withdrawal_completed', kind: 'withdrawal', txRef: 'old-receipt', requestId: 'old-request' });
  assert.equal(readChapaStorage(key), 'new-request');
});
