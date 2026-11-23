import assert from 'node:assert/strict';
import test from 'node:test';
import { storageObjectFromUrl } from '../lib/storageReference.ts';

const active = 'https://fkeyentcklsuqecqgmak.supabase.co';
const retired = 'https://zewcewkqruxlniavsrgj.supabase.co';
const buckets = ['post-media', 'chat-media'] as const;

test('parses active and retired Serkle storage URLs as the same object identity', () => {
  const path = 'user-id/folder/My%20Photo.jpg';
  const expected = { bucket: 'post-media', path: 'user-id/folder/My Photo.jpg' };
  assert.deepEqual(storageObjectFromUrl(`${active}/storage/v1/object/public/post-media/${path}`, active, buckets), expected);
  assert.deepEqual(storageObjectFromUrl(`${retired}/storage/v1/object/public/post-media/${path}`, active, buckets), expected);
  assert.deepEqual(storageObjectFromUrl(`${retired}/storage/v1/object/sign/post-media/${path}?token=expired`, active, buckets), expected);
});

test('rejects foreign projects, unapproved buckets and unsafe paths', () => {
  assert.equal(storageObjectFromUrl('https://foreign.supabase.co/storage/v1/object/public/post-media/a.jpg', active, buckets), null);
  assert.equal(storageObjectFromUrl(`${active}/storage/v1/object/public/avatars/a.jpg`, active, buckets), null);
  assert.throws(() => storageObjectFromUrl(`${active}/storage/v1/object/public/post-media/a/%2E%2E/b.jpg`, active, buckets));
});
