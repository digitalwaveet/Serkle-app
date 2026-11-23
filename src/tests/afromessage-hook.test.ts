import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAfroMessageOtpRequest,
  isAfroMessageSuccess,
  normalizeAfroMessageRecipient,
  safeAfroMessageErrorMessage,
} from '../../supabase/functions/_shared/afroMessage.ts';

const identifierId = '11111111-1111-4111-8111-111111111111';

test('normalizes Ethiopian Ethio Telecom and Safaricom numbers to E.164', () => {
  assert.equal(normalizeAfroMessageRecipient('+251911223366'), '+251911223366');
  assert.equal(normalizeAfroMessageRecipient('0911223366'), '+251911223366');
  assert.equal(normalizeAfroMessageRecipient('0711223366'), '+251711223366');
  assert.equal(normalizeAfroMessageRecipient('711223366'), '+251711223366');
});

test('builds an AfroMessage send request without changing the Supabase OTP', () => {
  assert.deepEqual(buildAfroMessageOtpRequest('+251911223366', '561166', 'Serkle', identifierId), {
    to: '+251911223366',
    sender: 'Serkle',
    from: identifierId,
    message: 'Your Serkle verification code is 561166. Do not share this code.',
  });
});

test('rejects malformed phone numbers, OTPs, senders and identifiers', () => {
  assert.throws(() => normalizeAfroMessageRecipient('not-a-phone'));
  assert.throws(() => buildAfroMessageOtpRequest('+251911223366', '12ab', 'Serkle', identifierId));
  assert.throws(() => buildAfroMessageOtpRequest('+251911223366', '561166', 'Sender name too long', identifierId));
  assert.throws(() => buildAfroMessageOtpRequest('+251911223366', '561166', 'Serkle', 'invalid'));
});

test('only accepts an HTTP success acknowledged by AfroMessage', () => {
  assert.equal(isAfroMessageSuccess(true, { acknowledge: 'success', response: {} }), true);
  assert.equal(isAfroMessageSuccess(true, { acknowledge: 'error', response: {} }), false);
  assert.equal(isAfroMessageSuccess(false, { acknowledge: 'success', response: {} }), false);
  assert.equal(isAfroMessageSuccess(true, null), false);
});

test('maps provider failures to safe user-facing messages', () => {
  assert.match(safeAfroMessageErrorMessage(401, null), /credentials/i);
  assert.match(safeAfroMessageErrorMessage(429, null), /rate limit/i);
  assert.match(safeAfroMessageErrorMessage(503, null), /unavailable/i);
  assert.match(
    safeAfroMessageErrorMessage(422, {
      acknowledge: 'error',
      response: { errors: ['The sender name is not approved.'] },
    }),
    /sender name is not approved/i,
  );
});
