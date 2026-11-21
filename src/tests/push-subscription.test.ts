import assert from 'node:assert/strict';
import test from 'node:test';
import { pushSubscriptionUsesKey, urlBase64ToUint8Array } from '../lib/pushSubscription.ts';

const vapidKey = 'BNyajxlkWQYqN0F0oUFbVBjCsP1JFokiuJaL0V5aO42PyRUL-1NEmwu58hXfYvtC89pkIlPZcRQQ1UgI4MvkDyI';

test('recognizes a subscription made with the configured VAPID key', () => {
  const bytes = urlBase64ToUint8Array(vapidKey);
  const subscription = { options: { applicationServerKey: bytes.buffer } } as Pick<PushSubscription, 'options'>;
  assert.equal(pushSubscriptionUsesKey(subscription, vapidKey), true);
});

test('rejects a subscription made with a stale VAPID key', () => {
  const bytes = urlBase64ToUint8Array(vapidKey);
  bytes[bytes.length - 1] ^= 1;
  const subscription = { options: { applicationServerKey: bytes.buffer } } as Pick<PushSubscription, 'options'>;
  assert.equal(pushSubscriptionUsesKey(subscription, vapidKey), false);
});

test('rejects missing and malformed application server keys', () => {
  const subscription = { options: { applicationServerKey: null } } as Pick<PushSubscription, 'options'>;
  assert.equal(pushSubscriptionUsesKey(subscription, vapidKey), false);
  assert.equal(pushSubscriptionUsesKey(subscription, '%%%'), false);
});
