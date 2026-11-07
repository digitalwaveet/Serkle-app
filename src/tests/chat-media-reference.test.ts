import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chatStorageObject,
  privateChatPath,
} from "../lib/chatMediaReference.ts";
const origin = "https://sample-project.supabase.co",
  cid = "10000000-0000-4000-8000-000000000001",
  uid = "20000000-0000-4000-8000-000000000001";
test("new private references retain their validated conversation and uploader path", () => {
  const path = `${cid}/${uid}/photo.jpg`;
  assert.equal(privateChatPath("chat-media://" + path), path);
  assert.deepEqual(chatStorageObject("chat-media://" + path, origin), {
    bucket: "chat-media",
    path,
  });
});
test("legacy public URLs in the now-private shared bucket are resolved rather than rendered publicly", () => {
  const path = `${cid}/1773820147587_0_sgcj.jpg`;
  assert.deepEqual(
    chatStorageObject(
      `${origin}/storage/v1/object/public/post-media/${path}?_retry=3`,
      origin,
    ),
    { bucket: "post-media", path },
  );
});
test("persisted signed URLs are renewed by stable path without reusing bearer query parameters", () => {
  assert.deepEqual(
    chatStorageObject(
      `${origin}/storage/v1/object/sign/post-media/${cid}/old%20photo.jpg?token=expired&_retry=2`,
      origin,
    ),
    { bucket: "post-media", path: `${cid}/old photo.jpg` },
  );
});
test("other origins, unsupported buckets and ordinary external links do not receive the app session", () => {
  for (const ref of [
    `https://other.supabase.co/storage/v1/object/public/post-media/${cid}/photo.jpg`,
    `${origin}/storage/v1/object/public/private-documents/photo.jpg`,
    "https://example.com/image.png",
    `https://someone:password@sample-project.supabase.co/storage/v1/object/public/post-media/photo.jpg`,
  ])
    assert.equal(chatStorageObject(ref, origin), null);
});
test("invalid private namespaces, traversal, malformed escapes and path-control characters are rejected", () => {
  for (const ref of [
    "chat-media://bad/file.jpg",
    `chat-media://${cid}/${uid}/..`,
    `${origin}/storage/v1/object/public/post-media/${cid}/%2e%2e/secret.jpg`,
    `${origin}/storage/v1/object/public/post-media/file%00.jpg`,
    `${origin}/storage/v1/object/public/post-media/%E0%A4`,
    `${origin}/storage/v1/object/public/post-media/folder%5Cfile.jpg`,
  ])
    assert.throws(() => chatStorageObject(ref, origin));
});
