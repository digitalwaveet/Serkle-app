import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { extractVideoDuration, formatVideoDuration, parseVideoDuration } from '../lib/videoDuration.ts';

class MetadataVideo extends EventTarget {
  duration = NaN;
  currentTime = 0;
  src = '';
  loadCalls = 0;
  load() { this.loadCalls++; }
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
  metadata(seconds: number, event = 'loadedmetadata') {
    this.duration = seconds;
    this.dispatchEvent(new Event(event));
  }
}

function mockVideo(t: TestContext) {
  const video = new MetadataVideo();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: (tag: string) => { assert.equal(tag, 'video'); return video; } },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const create = t.mock.method(URL, 'createObjectURL', () => 'blob:duration-test');
  const revoke = t.mock.method(URL, 'revokeObjectURL', () => undefined);
  return { video, create, revoke };
}

test('pending, missing, failed and legacy zero metadata have no duration label', () => {
  for (const value of [undefined, null, '', ' ', 0, '0', '0:00', '00:00:00', NaN, Infinity, -3, 'NaN', 'Infinity', 'failed', '1:60', '1:99:00', {}, false]) {
    assert.equal(parseVideoDuration(value), null, String(value));
    assert.equal(formatVideoDuration(value), null, String(value));
  }
});

test('valid seconds and legacy clock values keep accurate durations', () => {
  for (const value of [125.5, '125.5', '2:05.5']) {
    assert.equal(parseVideoDuration(value), 125.5);
    assert.equal(formatVideoDuration(value), '2:05');
  }
  assert.equal(formatVideoDuration('59:59'), '59:59');
  assert.equal(parseVideoDuration('1:02:03'), 3723);
  assert.equal(formatVideoDuration('1:02:03'), '1:02:03');
  assert.equal(formatVideoDuration('60:00'), '1:00:00');
  assert.equal(formatVideoDuration(0.25), '0:01');
});

test('extraction stays pending through initial zero/NaN until durationchange is valid', async t => {
  const { video, revoke } = mockVideo(t);
  let settled = false;
  const result = extractVideoDuration(new Blob(['video'])).then(value => { settled = true; return value; });
  assert.equal(settled, false);
  video.metadata(0);
  video.metadata(NaN, 'durationchange');
  await Promise.resolve();
  assert.equal(settled, false);
  video.metadata(187.75, 'durationchange');
  assert.equal(await result, 187.75);
  assert.equal(video.src, '');
  assert.equal(revoke.mock.callCount(), 1);
  video.metadata(0, 'durationchange');
  assert.equal(revoke.mock.callCount(), 1);
});

test('an unindexed WebM can recover finite metadata after the Infinity seek', async t => {
  const { video } = mockVideo(t);
  const result = extractVideoDuration(new Blob(['webm']));
  video.metadata(Infinity);
  assert.equal(video.currentTime, Number.MAX_SAFE_INTEGER);
  video.metadata(9.5, 'seeked');
  assert.equal(await result, 9.5);
});

test('failed extraction returns unknown and releases the file URL', async t => {
  const { video, revoke } = mockVideo(t);
  const result = extractVideoDuration(new Blob(['unsupported']));
  video.dispatchEvent(new Event('error'));
  assert.equal(await result, null);
  assert.equal(video.src, '');
  assert.equal(revoke.mock.callCount(), 1);
});

test('missing metadata times out instead of holding up upload processing', async t => {
  const { video, revoke } = mockVideo(t);
  assert.equal(await extractVideoDuration(new Blob(['incomplete']), { timeoutMs: 5 }), null);
  assert.equal(video.src, '');
  assert.equal(revoke.mock.callCount(), 1);
});

test('aborting a pending probe cancels the media read and cleans up', async t => {
  const { video, revoke } = mockVideo(t);
  const controller = new AbortController();
  const result = extractVideoDuration(new Blob(['video']), { signal: controller.signal });
  controller.abort();
  assert.equal(await result, null);
  assert.equal(video.src, '');
  assert.equal(revoke.mock.callCount(), 1);
});

test('already cancelled extraction allocates no media or blob URL', async t => {
  const { video, create } = mockVideo(t);
  const controller = new AbortController();
  controller.abort();
  assert.equal(await extractVideoDuration(new Blob(), { signal: controller.signal }), null);
  assert.equal(video.loadCalls, 0);
  assert.equal(create.mock.callCount(), 0);
});

test('legacy remote videos recover without allocating a local file URL', async t => {
  const { video, create, revoke } = mockVideo(t);
  const result = extractVideoDuration('https://example.test/legacy.mp4');
  assert.equal(video.src, 'https://example.test/legacy.mp4');
  video.metadata(61);
  assert.equal(await result, 61);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(revoke.mock.callCount(), 0);
});

test('a media loading exception becomes unknown metadata, without leaking URLs', async t => {
  const { video, revoke } = mockVideo(t);
  t.mock.method(video, 'load', () => { throw new Error('Unsupported video'); });
  assert.equal(await extractVideoDuration(new Blob(['video'])), null);
  assert.equal(revoke.mock.callCount(), 1);
});
