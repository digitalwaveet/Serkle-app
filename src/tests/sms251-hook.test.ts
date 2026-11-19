import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSms251OtpRequest,
  isSms251Success,
  normalizeSms251Recipient,
  safeSms251ErrorMessage,
} from '../../supabase/functions/_shared/sms251.ts';

test('normalizes Ethiopian Supabase E.164 numbers for 251SMS', () => {
  assert.equal(normalizeSms251Recipient('+251911223366'), '0911223366');
  assert.equal(normalizeSms251Recipient('+251711223366'), '0711223366');
});

test('keeps international recipients as digits without the plus sign', () => {
  assert.equal(normalizeSms251Recipient('+254712345678'), '254712345678');
});

test('builds the documented 251SMS OTP request without changing the OTP', () => {
  const request = buildSms251OtpRequest('+251911223366', '561166', 'Serkle');

  assert.deepEqual(request, {
    recipient: '0911223366',
    sender_id: 'Serkle',
    type: 'otp',
    message: 'Your Serkle verification code is 561166. Do not share this code.',
  });
});

test('rejects malformed phone numbers, OTPs and sender IDs', () => {
  assert.throws(() => normalizeSms251Recipient('not-a-phone'));
  assert.throws(() => buildSms251OtpRequest('+251911223366', '12ab', 'Serkle'));
  assert.throws(() => buildSms251OtpRequest('+251911223366', '561166', 'Sender name too long'));
});

test('only accepts an HTTP success with a provider success status', () => {
  assert.equal(isSms251Success(true, { status: 'success' }), true);
  assert.equal(isSms251Success(true, { status: 'error' }), false);
  assert.equal(isSms251Success(false, { status: 'success' }), false);
  assert.equal(isSms251Success(true, null), false);
});

test('maps provider failures to safe user-facing messages', () => {
  assert.match(safeSms251ErrorMessage(401, null), /credentials/i);
  assert.match(safeSms251ErrorMessage(429, null), /rate limit/i);
  assert.match(safeSms251ErrorMessage(503, null), /unavailable/i);
  assert.match(
    safeSms251ErrorMessage(422, { status: 'error', message: 'Invalid sender id' }),
    /Invalid sender id/,
  );
});
