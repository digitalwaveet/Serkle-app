import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authMethodForIdentifier,
  authErrorMessage,
  isUnverifiedAuthError,
  isValidEmail,
  maskAuthIdentifier,
  normalizeEmail,
  normalizePhone,
} from '../lib/authIdentity.ts';
import { authReturnPath } from '../lib/authReturnPath.ts';

test('normalizes email identifiers', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('invalid-email'), false);
});

test('normalizes Ethiopian local and international phone numbers', () => {
  assert.equal(normalizePhone('0911 123 456'), '+251911123456');
  assert.equal(normalizePhone('251-911-123-456'), '+251911123456');
  assert.equal(normalizePhone('00251 911 123 456'), '+251911123456');
  assert.equal(normalizePhone('+251 (911) 123-456'), '+251911123456');
});

test('supports another supplied country calling code', () => {
  assert.equal(normalizePhone('0712 345 678', '+254'), '+254712345678');
});

test('rejects invalid phone numbers', () => {
  assert.throws(() => normalizePhone('123'), /valid phone number/i);
});

test('detects email and phone values from the combined login field', () => {
  assert.equal(authMethodForIdentifier(' member@example.com '), 'email');
  assert.equal(authMethodForIdentifier('0911 123 456'), 'phone');
  assert.equal(authMethodForIdentifier('+251711223344'), 'phone');
  assert.throws(() => authMethodForIdentifier('not-an-account'), /email address or phone number/i);
});

test('masks verification destinations without hiding their identity type', () => {
  assert.equal(maskAuthIdentifier('email', 'person@example.com'), 'pe••••@example.com');
  assert.equal(maskAuthIdentifier('phone', '+251911123456'), '+251••••••456');
});

test('recognizes unverified account errors and maps actionable messages', () => {
  const phoneError = Object.assign(new Error('Phone not confirmed'), { code: 'phone_not_confirmed' });
  assert.equal(isUnverifiedAuthError(phoneError), true);
  assert.match(authErrorMessage(phoneError), /verify your phone/i);

  const expired = Object.assign(new Error('expired'), { code: 'otp_expired' });
  assert.match(authErrorMessage(expired), /expired/i);
});

test('preserves safe app destinations and rejects redirect injection', () => {
  assert.equal(authReturnPath(`?returnTo=${encodeURIComponent('/ask')}`), '/ask');
  assert.equal(authReturnPath(`?returnTo=${encodeURIComponent('/create/video')}`), '/create/video');
  assert.equal(authReturnPath(`?returnTo=${encodeURIComponent('/shop/messages')}`), '/shop/messages');
  assert.equal(authReturnPath(`?returnTo=${encodeURIComponent('https://evil.example')}`), '/');
  assert.equal(authReturnPath(`?returnTo=${encodeURIComponent('//evil.example')}`), '/');
  assert.equal(authReturnPath(`?returnTo=${encodeURIComponent('/circle/../../evil')}`), '/');
});

