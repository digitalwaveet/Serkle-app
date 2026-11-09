import { processImageAsset } from '../server/imageProcessor.ts';
import { createImagePreviewGateway } from '../server/imagePreviewGateway.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const maintenanceKey = process.env.IMAGE_PREVIEW_MAINTENANCE_SECRET;
if (!url || !key || !maintenanceKey) {
  throw new Error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and IMAGE_PREVIEW_MAINTENANCE_SECRET for the image worker.');
}
const gateway = createImagePreviewGateway(url, key, { 'x-image-maintenance-key': maintenanceKey });
const backfill = process.argv.includes('--backfill'), watch = process.argv.includes('--watch');
let processed = 0, failed = 0;
do {
  if (backfill) {
    // Register one legacy original at a time so a backfill does not replace a
    // whole gallery with processing skeletons while it waits in the queue.
    await gateway.enqueueLegacy();
  }
  const claim = await gateway.claim();
  if (claim.status !== 'claimed') {
    if (!watch) break;
    await new Promise(resolve => setTimeout(resolve, 5000));
    continue;
  }
  try { await processImageAsset(gateway, claim.job); processed++; }
  catch { failed++; }
  console.log(JSON.stringify({ processed, failed }));
} while (true);
