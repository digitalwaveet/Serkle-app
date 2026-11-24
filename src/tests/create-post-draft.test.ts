import assert from 'node:assert/strict';
import test from 'node:test';
import { canPublishPostDraft, createPostType } from '../lib/createPostDraft.ts';

test('post type follows the attached media instead of labeling videos as photos', () => {
  assert.equal(createPostType([], false), 'text');
  assert.equal(createPostType([{ kind: 'image' }], false), 'photo');
  assert.equal(createPostType([{ kind: 'image' }, { kind: 'video' }], false), 'video');
  assert.equal(createPostType([{ kind: 'video' }], true), 'pdf');
});

test('publish requires real content and stays disabled during loading or submission', () => {
  const base = { text: '', mediaCount: 0, hasPdf: false, hasVoice: false, creating: false, shareReady: true };
  assert.equal(canPublishPostDraft(base), false);
  assert.equal(canPublishPostDraft({ ...base, text: 'Hello' }), true);
  assert.equal(canPublishPostDraft({ ...base, mediaCount: 1 }), true);
  assert.equal(canPublishPostDraft({ ...base, hasVoice: true }), true);
  assert.equal(canPublishPostDraft({ ...base, text: 'Hello', creating: true }), false);
  assert.equal(canPublishPostDraft({ ...base, text: 'Hello', shareReady: false }), false);
});
