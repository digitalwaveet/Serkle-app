import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { detectImageMime, fitImage, imageDigest, imageObject, previewPath, isAnimatedImage } from '../lib/imageAsset.ts';
import { processImageAsset } from '../../server/imageProcessor.ts';
import type { ImagePreviewJob } from '../../supabase/functions/_shared/imagePreviewProtocol.ts';
import type { ImagePreviewStorage } from '../../server/imagePreviewGateway.ts';
import { imageDatabase, imageMigration, imageRole, imageRpc, owner, member, outsider, operation, conversation } from './fixtures/image-assets-db.ts';
let db: PGlite;
const path = `${conversation}/${owner}/original.png`;
const hash = 'a'.repeat(64);
before(async () => { db = await imageDatabase(); });
after(() => db?.close());
async function object(bucket: string, name: string, mime = 'image/png', bytes = 4000, uploader = owner) {
  await db.exec('RESET ROLE');
  await db.query('INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES($1,$2,$3,$4) ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=EXCLUDED.metadata', [bucket, name, uploader, JSON.stringify({ mimetype: mime, size: bytes })]);
}
let asset: any;
test('resizing respects the long edge, orientation and never enlarges small images', () => {
  assert.deepEqual(fitImage(4000, 6000, 1280), { width: 853, height: 1280 });
  assert.deepEqual(fitImage(120, 80, 360), { width: 120, height: 80 });
  assert.throws(() => fitImage(0, 800, 1280));
});
test('storage identity strips expiring credentials and only accepts this project', () => {
  const origin = 'https://example.supabase.co';
  assert.deepEqual(imageObject(`${origin}/storage/v1/object/sign/chat-media/${path}?token=expired`, origin), { bucket: 'chat-media', path });
  assert.equal(imageObject(`https://foreign.test/storage/v1/object/public/post-media/a.jpg`, origin), null);
  assert.throws(() => imageObject(`chat-media://a/../secret`, origin));
});
test('photo identification rejects renamed SVG, HTML and documents', () => {
  assert.equal(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(detectImageMime(Buffer.from('<html>not a photo</html>')), null);
  assert.equal(detectImageMime(Buffer.from('%PDF-1.7')), null);
  assert.equal(detectImageMime(Buffer.from([255,216,255,224])), 'image/jpeg');
});
test('an uploaded original starts processing and duplicate prepares retain one asset', async () => {
  await object('chat-media', path);
  await imageRole(db);
  asset = await imageRpc(db, 'prepare_image_asset', ['chat-media', path, 'Original Photo.png', 'image/png', hash, operation]);
  assert.equal(asset.status, 'processing');
  assert.deepEqual(asset.variants, {});
  const retry = await imageRpc(db, 'prepare_image_asset', ['chat-media', path, 'Original Photo.png', 'image/png', hash, operation]);
  assert.equal(retry.id, asset.id);
  assert.equal((await db.query('SELECT * FROM media_image_assets')).rows.length, 1);
});
test('another member cannot claim the upload, finalize it, or change its original identity', async () => {
  await imageRole(db, member);
  await assert.rejects(imageRpc(db, 'prepare_image_asset', ['chat-media', path, 'fake.png', 'image/png', hash, operation]), /unavailable/);
  await assert.rejects(imageRpc(db, 'complete_image_asset', [asset.id, operation, 400, 300, '{}', false]), /unavailable/);
  await assert.rejects(db.query('UPDATE media_image_assets SET original_path=$1 WHERE id=$2', ['other', asset.id]), /permission denied/);
});
test('completion refuses missing previews; failure retains the original for recovery', async () => {
  await imageRole(db);
  await assert.rejects(imageRpc(db, 'complete_image_asset', [asset.id, operation, 400, 300, '{}', false]), /Invalid image preview/);
  await imageRpc(db, 'fail_image_asset', [asset.id, operation]);
  const row = (await db.query<any>('SELECT * FROM media_image_assets WHERE id=$1', [asset.id])).rows[0];
  assert.equal(row.status, 'failed');
  assert.equal(row.original_path, path);
  assert.equal(row.original_bytes, 4000);
});
test('only the service worker can claim failed jobs and concurrent claims do not duplicate work', async () => {
  await imageRole(db);
  await assert.rejects(imageRpc(db, 'claim_image_asset', [asset.id]), /permission denied/);
  await imageRole(db, '', 'service_role');
  asset = await imageRpc(db, 'claim_image_asset', [asset.id]);
  assert.equal(asset.status, 'processing');
  assert.equal(await imageRpc(db, 'claim_image_asset', [asset.id]), null);
});
test('successful completion records confirmed WebP variants while preserving exact original metadata', async () => {
  const variants = {};
  for (const size of ['thumb', 'display', 'full'] as const) {
    await object('chat-media', previewPath(path, size), 'image/webp', 1500);
    variants[size] = { path: previewPath(path, size), width: 300, height: 200 };
  }
  await imageRole(db, '', 'service_role');
  asset = await imageRpc(db, 'complete_image_asset', [asset.id, asset.processing_token, 300, 200, variants, false]);
  assert.equal(asset.status, 'ready');
  assert.equal(asset.original_sha256, hash);
  assert.equal(asset.original_name, 'Original Photo.png');
  assert.equal(asset.variants.display.bytes, 1500);
});
test('chat metadata and previews respect membership, including after leaving', async () => {
  await imageRole(db, member);
  assert.equal((await db.query('SELECT * FROM media_image_assets WHERE id=$1', [asset.id])).rows.length, 1);
  await imageRole(db, outsider);
  assert.equal((await db.query('SELECT * FROM media_image_assets WHERE id=$1', [asset.id])).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [previewPath(path, 'thumb')])).rows.length, 0);
  await db.exec('RESET ROLE');
  await db.query('DELETE FROM conversation_members WHERE user_id=$1', [member]);
  await imageRole(db, member);
  assert.equal((await db.query('SELECT * FROM media_image_assets WHERE id=$1', [asset.id])).rows.length, 0);
});
test('Circle premium preview requests inherit the original entitlement and revoked access', async () => {
  const premiumPath = `${owner}/premium.jpg`;
  await object('post-media', premiumPath, 'image/jpeg');
  await imageRole(db);
  const premium = await imageRpc(db, 'prepare_image_asset', ['post-media', premiumPath, 'premium.jpg', 'image/jpeg', hash, operation]);
  await object('post-media', previewPath(premiumPath, 'thumb'), 'image/webp');
  await db.query('INSERT INTO posts(circle_id,is_premium,media_url) VALUES($1,true,$2)', [conversation, premiumPath]);
  const post = (await db.query<any>('SELECT id FROM posts LIMIT 1')).rows[0].id;
  await imageRole(db, outsider);
  assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [previewPath(premiumPath, 'thumb')])).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM media_image_assets WHERE id=$1', [premium.id])).rows.length, 0);
  await db.exec('RESET ROLE');
  await db.query('INSERT INTO test_entitlements VALUES($1,$2)', [outsider, post]);
  await imageRole(db, outsider);
  assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [previewPath(premiumPath, 'thumb')])).rows.length, 1);
  await db.exec('RESET ROLE');
  await db.exec('DELETE FROM test_entitlements');
  await imageRole(db, outsider);
  assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [previewPath(premiumPath, 'thumb')])).rows.length, 0);
});
test('the migration can be reapplied without changing existing RPC return types or losing assets', async () => {
  await db.exec('RESET ROLE');
  await db.exec(await imageMigration());
  assert.equal((await db.query('SELECT * FROM media_image_assets WHERE id=$1', [asset.id])).rows.length, 1);
});
function processorFixture(original: Buffer) {
  const job: ImagePreviewJob = {
    assetId: asset.id, lease: operation, originalUrl: 'https://example.test/original',
    originalBytes: original.length, originalSha256: null,
  };
  const outputs: Buffer[] = [];
  const storage: ImagePreviewStorage = {
    download: async () => new Blob([new Uint8Array(original)]),
    upload: async (_job, _size, bytes) => { outputs.push(Buffer.from(bytes)); },
    complete: async (_job, result) => result,
    fail: async () => {},
  };
  return { job, storage, outputs };
}
test('real Sharp processing writes WebP previews, rotates EXIF and leaves the original byte-for-byte unchanged', async () => {
  const original = await sharp({ create: { width: 2400, height: 1600, channels: 4, background: { r: 113, g: 58, b: 32, alpha: 0.5 } } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const before = Buffer.from(original);
  const { job, storage, outputs } = processorFixture(original);
  job.originalSha256 = await imageDigest(await storage.download(job));
  assert.deepEqual(await processImageAsset(storage, job), { status: 'ready' });
  assert.equal(outputs.length, 3);
  for (const [i, output] of outputs.entries()) {
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.orientation, undefined);
    assert.ok(metadata.width! <= [360, 1280, 1920][i]);
    assert.ok(metadata.height! <= [360, 1280, 1920][i]);
    assert.ok(metadata.height! > metadata.width!);
  }
  assert.deepEqual(original, before);
});
test('failed server decoding preserves the original and records a recoverable failure', async () => {
  let failed = false;
  const bad = Buffer.from('invalid image');
  const { job, storage } = processorFixture(bad);
  storage.fail = async () => { failed = true; };
  await assert.rejects(processImageAsset(storage, job), /original is retained/);
  assert.equal(failed, true);
});
test('animated previews retain frames and transparent PNG previews retain alpha', async () => {
  const frames = Buffer.from([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255]);
  const gif = await sharp(frames, { raw: { width: 2, height: 2, channels: 4, pageHeight: 1 } }).gif({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal(isAnimatedImage(gif, 'image/gif'), true);
  const transparent = await sharp({ create: { width: 40, height: 60, channels: 4, background: { r: 80, g: 40, b: 20, alpha: 0.4 } } }).png().toBuffer();
  for (const [input, animated] of [[gif, true], [transparent, false]] as const) {
    const { job, storage, outputs } = processorFixture(input);
    let completedAnimation;
    storage.complete = async (_job, result) => { completedAnimation = result.animated; };
    await processImageAsset(storage, job);
    for (const output of outputs) {
      const metadata = await sharp(output, { animated: true }).metadata();
      if (animated) assert.equal(metadata.pages, 2);
      else assert.equal(metadata.hasAlpha, true);
    }
    assert.equal(completedAnimation, animated);
  }
});
test('stale processing leases can be reclaimed, and old tokens cannot complete the job', async () => {
  await db.exec('RESET ROLE');
  await db.query("UPDATE media_image_assets SET status='processing',processing_token=$1,lease_until=now()-interval '1 minute',attempts=1,next_attempt_at=now() WHERE id=$2", [operation, asset.id]);
  await imageRole(db, '', 'service_role');
  const reclaimed = await imageRpc(db, 'claim_image_asset', [asset.id]);
  assert.notEqual(reclaimed.processing_token, operation);
  await assert.rejects(imageRpc(db, 'complete_image_asset', [asset.id, operation, 300, 200, {}, false]), /lease expired/);
  await imageRpc(db, 'fail_image_asset', [asset.id, reclaimed.processing_token]);
});
test('legacy queuing is idempotent and existing originals cannot be overwritten by clients', async () => {
  const legacyPath = `${owner}/legacy.png`;
  await object('post-media', legacyPath);
  await imageRole(db, '', 'service_role');
  assert.equal(await imageRpc(db, 'enqueue_legacy_image_previews', [100]), 1);
  assert.equal(await imageRpc(db, 'enqueue_legacy_image_previews', [100]), 0);
  await imageRole(db);
  const updated = await db.query('UPDATE storage.objects SET metadata=$1 WHERE bucket_id=$2 AND name=$3 RETURNING name', [JSON.stringify({ size: 99 }), 'post-media', legacyPath]);
  assert.equal(updated.rows.length, 0);
});
test('new originals are private from initial upload through processing and publish atomically with their post', async () => {
  const originalPath = `${owner}/serkle_image_v1_draft.png`;
  await object('post-media', originalPath);
  await imageRole(db, outsider);
  assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [originalPath])).rows.length, 0, 'the upload-to-registration gap is private');
  await imageRole(db);
  const draft = await imageRpc(db, 'prepare_image_asset', ['post-media', originalPath, 'draft.png', 'image/png', hash, operation]);
  await object('post-media', previewPath(originalPath, 'display'), 'image/webp');
  await imageRole(db, outsider);
  assert.equal((await db.query('SELECT * FROM media_image_assets WHERE id=$1', [draft.id])).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [previewPath(originalPath, 'display')])).rows.length, 0);
  await db.exec('RESET ROLE');
  const post = (await db.query<any>('INSERT INTO posts(is_premium,media_url) VALUES(false,$1) RETURNING id', [originalPath])).rows[0];
  await imageRole(db, outsider);
  assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [previewPath(originalPath, 'display')])).rows.length, 1);
  await db.exec('RESET ROLE');
  await db.query('DELETE FROM posts WHERE id=$1', [post.id]);
  await imageRole(db, outsider);
  assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [originalPath])).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [previewPath(originalPath, 'display')])).rows.length, 0);
});
test('an authorized editor can attach their own upload to another author’s post', async () => {
  const editedPath = `${member}/serkle_image_v1_edited-cover.png`;
  await object('post-media', editedPath, 'image/png', 4000, member);
  await imageRole(db, member);
  const edited = await imageRpc(db, 'prepare_image_asset', ['post-media', editedPath, 'edited-cover.png', 'image/png', hash, operation]);
  await db.exec('RESET ROLE');
  // Parent post permissions are enforced by the existing posts RLS. This
  // fixture grants the write to exercise the trigger under the editor identity.
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [member]);
  await db.query('INSERT INTO posts(user_id,is_premium,cover_image_url) VALUES($1,false,$2)', [owner, editedPath]);
  await imageRole(db, outsider);
  assert.equal((await db.query('SELECT * FROM media_image_assets WHERE id=$1', [edited.id])).rows.length, 1);
});
