# WebP previews and original downloads

Messages, feed posts, post details, Circle post covers, and rendered PDF pages use the shared `OptimizedImage` component. New images retain their original bytes in private Supabase Storage. The browser generates three WebP siblings (360 / 1280 / 1920 pixels on the longest edge), with no enlargement. `media_image_assets` stores their paths, original filename, MIME, byte size, SHA-256, dimensions, and processing state. Posts and messages continue to store the stable **original reference**, not a temporary signed URL.

Until the actual image fires `load`, the component shows an accessible skeleton. Offscreen images wait until close to the viewport. Failures show Retry; a registered asset never automatically falls back to downloading the original. Fullscreen uses the 1920px preview. Download original signs the original object on click, with its original filename, without transformation. Signed preview URLs renew and are scoped to the signed-in account, with no persistence to IndexedDB. Existing conversation and Circle entitlement checks protect derivatives too.

New post images remain private to the uploader until a database trigger confirms their parent post. Changing or deleting that post updates publication access in the same transaction. This closes the interval between upload completion and saving premium-content rules.

## Deployment order

1. Apply `supabase/migrations/20261108130000_image_previews.sql` in the Supabase SQL editor. Prerequisites: the existing chat privacy and Circle entitlement/storage migrations. This migration creates the metadata table, permission guards and processing RPCs. It does not delete files, membership, purchases, or posts, and can be rerun.
2. From the project root, deploy the `image-previews` Edge Function with the Supabase CLI. Supabase supplies its project keys inside the function. [Supabase Edge Function environment variables](https://supabase.com/docs/guides/functions/secrets)
   ```sh
   npx supabase functions deploy image-previews --project-ref zewcewkqruxlniavsrgj --use-api
   ```
3. Redeploy the app on Vercel with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Vite also uses these public values for the browser, with the explicit `VITE_SUPABASE_*` settings taking precedence if present.

The Edge Function verifies the caller's user token through Supabase Auth and checks ownership, current access and the processing lease. It signs a short-lived read URL for the original, stores WebP previews at the asset's fixed paths and updates the job through the existing service-only RPCs. Vercel runs Sharp with the publishable key and the caller's session. The function uses its project credentials inside Supabase. Native Sharp runs on Vercel because it needs a Node runtime with native libraries. [Supabase image processing runtime](https://supabase.com/docs/guides/functions/examples/image-manipulation)

### Optional backfill worker

To process existing images or retry interrupted jobs in bulk, set a randomly generated `IMAGE_PREVIEW_MAINTENANCE_SECRET` of at least 32 characters in the Edge Function secrets. Set the same value alongside `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the private environment where you run the worker. This secret authorizes the image queue and its associated objects only. Ordinary uploads and interactive recovery use the user's session.

Run `npm run images:process -- --backfill` to process existing stored images a job at a time. Add `--watch` to keep the worker running for interrupted jobs. Retryable failures back off and stop after five automatic attempts. Legacy images continue to use their stored originals until registered. Previously compressed originals cannot be reconstructed.

## Processing and format handling

The original is uploaded before conversion, including HEIC. A hash in the object name and a stable operation ID make retries reuse the same original. The database confirms original ownership and all three uploaded WebP objects before marking the asset ready. Registered originals and client-generated variants cannot be overwritten by authenticated clients. Uploads are limited to 50 MB; decoding is limited to 50 megapixels. Unsupported/failed images retain the original and expose recovery rather than a false ready state.

Canvas WebP output is checked by MIME type. Browsers returning PNG for a WebP request use the bundled WebP WASM encoder. Compression runs in a worker. HEIC conversion only creates a preview source. Animated GIF/PNG/WebP use server processing to preserve their frames. Server processing auto-orients EXIF photos and strips location/EXIF from previews while preserving the untouched original. Recovery fills in missing variants and keeps files already uploaded.

Storage tradeoff: originals plus three previews use more stored bytes; ordinary viewing transfers substantially fewer bytes for large photos. Resolution/quality presets live centrally in `src/lib/imageAsset.ts` and are shared with the server processor. Preview requests use private signed URLs; permission changes apply to new signatures, while an existing signature remains valid for at most five minutes.

Implementation references: [Supabase image processing runtime constraints](https://supabase.com/docs/guides/functions/examples/image-manipulation), [Vercel functions in Vite projects](https://vercel.com/docs/frameworks/frontend/vite), and [Vercel function duration configuration](https://vercel.com/docs/functions/configuring-functions/duration).

## Validation

- `npm run test:image-previews`: real PostgreSQL-compatible migration/RLS/RPC tests, original integrity, server image encoding, and recovery API authorization.
- `npm run test:image-previews-ui`: actual browser worker uploads and real Supabase SDK requests, genuine WebP decoding (including WASM fallback), delayed skeletons, original-only downloads, and failed-preview retry.
- `npm run test:messaging-ui` and `npm run test:messaging`: messaging layout, retry/delivery, legacy media, and group access regressions.
- `npm run build`.
