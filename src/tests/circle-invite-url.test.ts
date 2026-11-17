import assert from 'node:assert/strict';
import test from 'node:test';
import { getCircleInviteUrl } from '../lib/circleInviteUrl.ts';

test('Circle invitations use the current production origin', () => {
  assert.equal(
    getCircleInviteUrl('invite123', 'https://serkle-app-five.vercel.app'),
    'https://serkle-app-five.vercel.app/join/invite123',
  );
});

test('Circle invitations use the current local origin and port', () => {
  assert.equal(
    getCircleInviteUrl('invite123', 'http://localhost:8082'),
    'http://localhost:8082/join/invite123',
  );
});

test('Circle invitation codes are safely encoded', () => {
  assert.equal(
    getCircleInviteUrl('invite code/1', 'https://preview.example.com'),
    'https://preview.example.com/join/invite%20code%2F1',
  );
});
