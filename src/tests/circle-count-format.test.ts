import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCircleCount, getCircleCountLabel } from '../lib/circleCountFormat.ts';

test('member labels handle zero, one, and multiple members', () => {
  assert.equal(formatCircleCount(0, 'member', 'en'), '0 members');
  assert.equal(formatCircleCount(1, 'member', 'en'), '1 member');
  assert.equal(formatCircleCount(2, 'member', 'en'), '2 members');
});

test('video labels handle one and multiple videos', () => {
  assert.equal(formatCircleCount(1, 'video', 'en'), '1 video');
  assert.equal(formatCircleCount(2, 'video', 'en'), '2 videos');
});

test('count labels use the unit catalog and plural category', () => {
  assert.equal(getCircleCountLabel(1, 'event', 'en'), 'event');
  assert.equal(getCircleCountLabel(3, 'event', 'en'), 'events');
});
