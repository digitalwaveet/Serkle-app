import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultProfileAvatar,
  normalizeProfileGender,
  resolveProfileAvatar,
} from '../lib/profileAvatar.ts';

test('uses the supplied female illustration when no profile photo exists', () => {
  assert.equal(defaultProfileAvatar('female'), '/illustrations/profile-female.svg');
  assert.equal(resolveProfileAvatar(null, 'female'), '/illustrations/profile-female.svg');
});

test('uses the supplied male illustration when no profile photo exists', () => {
  assert.equal(defaultProfileAvatar('male'), '/illustrations/profile-male.svg');
  assert.equal(resolveProfileAvatar('', 'male'), '/illustrations/profile-male.svg');
});

test('never replaces an uploaded or OAuth profile photo', () => {
  assert.equal(resolveProfileAvatar('https://cdn.example/avatar.webp', 'female'), 'https://cdn.example/avatar.webp');
});

test('unknown gender keeps the existing initials fallback', () => {
  assert.equal(normalizeProfileGender('unknown'), null);
  assert.equal(defaultProfileAvatar('unknown'), '');
});
