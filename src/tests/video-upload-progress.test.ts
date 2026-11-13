import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { uploadFileWithProgress } from '../lib/uploadWithProgress.ts';

type Listener = (event: unknown) => void;

class EventHub {
  listeners = new Map<string, Listener[]>();
  addEventListener(name: string, listener: Listener) {
    this.listeners.set(name, [...(this.listeners.get(name) || []), listener]);
  }
  emit(name: string, event: unknown = {}) {
    for (const listener of this.listeners.get(name) || []) listener(event);
  }
}

class FakeRequest extends EventHub {
  static nextStatus = 200;
  static nextBody = '{}';
  static instances: FakeRequest[] = [];
  upload = new EventHub();
  status = 0;
  responseText = '';
  method = '';
  url = '';
  headers = new Map<string, string>();
  body: FormData | null = null;
  constructor() {
    super();
    FakeRequest.instances.push(this);
  }
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers.set(name, value); }
  send(body: FormData) {
    this.body = body;
    queueMicrotask(() => {
      this.upload.emit('progress', { lengthComputable: true, loaded: 25, total: 100 });
      this.upload.emit('progress', { lengthComputable: true, loaded: 100, total: 100 });
      this.status = FakeRequest.nextStatus;
      this.responseText = FakeRequest.nextBody;
      this.emit('load');
    });
  }
  abort() { this.emit('abort'); }
}

function mockRequest(t: TestContext) {
  FakeRequest.instances = [];
  FakeRequest.nextStatus = 200;
  FakeRequest.nextBody = '{}';
  const original = Object.getOwnPropertyDescriptor(globalThis, 'XMLHttpRequest');
  Object.defineProperty(globalThis, 'XMLHttpRequest', { configurable: true, value: FakeRequest });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'XMLHttpRequest', original);
    else Reflect.deleteProperty(globalThis, 'XMLHttpRequest');
  });
}

const bucket = {
  calls: [] as Array<{ path: string; upsert: boolean }>,
  async createSignedUploadUrl(path: string, options: { upsert: boolean }) {
    this.calls.push({ path, upsert: options.upsert });
    return { data: { signedUrl: 'https://storage.test/upload?token=signed', token: 'signed', path }, error: null };
  },
};

test('reports actual transmitted-byte progress through the signed upload request', async t => {
  mockRequest(t);
  bucket.calls = [];
  const progress: number[] = [];
  const file = new File([new Uint8Array(100)], 'clip.mp4', { type: 'video/mp4' });
  await uploadFileWithProgress(bucket, 'user/upload-clip.mp4', file, { onProgress: value => progress.push(value) });

  assert.deepEqual(progress, [0, 25, 100]);
  assert.deepEqual(bucket.calls, [{ path: 'user/upload-clip.mp4', upsert: true }]);
  const request = FakeRequest.instances[0];
  assert.equal(request.method, 'PUT');
  assert.equal(request.url, 'https://storage.test/upload?token=signed');
  assert.equal(request.headers.get('x-upsert'), 'true');
  assert.equal(request.body?.get('cacheControl'), '3600');
  assert.equal((request.body?.get('') as File).name, 'clip.mp4');
});

test('surfaces the storage response instead of appearing to do nothing', async t => {
  mockRequest(t);
  FakeRequest.nextStatus = 413;
  FakeRequest.nextBody = JSON.stringify({ message: 'The object exceeded the upload limit' });
  const file = new File([new Uint8Array(10)], 'large.mp4', { type: 'video/mp4' });
  await assert.rejects(
    uploadFileWithProgress(bucket, 'user/large.mp4', file),
    /exceeded the upload limit/,
  );
});

test('an already cancelled upload never creates a signed request', async () => {
  const controller = new AbortController();
  controller.abort();
  const before = bucket.calls.length;
  await assert.rejects(
    uploadFileWithProgress(bucket, 'user/cancelled.mp4', new Blob(['video']), { signal: controller.signal }),
    error => error instanceof DOMException && error.name === 'AbortError',
  );
  assert.equal(bucket.calls.length, before);
});
