import { encodeCircleCover, processImageAsset } from '../server/imageProcessor.ts';
import { createImagePreviewGateway } from '../server/imagePreviewGateway.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const maintenanceKey = process.env.IMAGE_PREVIEW_MAINTENANCE_SECRET;
if (!url || !key || !maintenanceKey) {
  throw new Error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and IMAGE_PREVIEW_MAINTENANCE_SECRET for the image worker.');
}
const gateway = createImagePreviewGateway(url, key, { 'x-image-maintenance-key': maintenanceKey });
const backfill = process.argv.includes('--backfill'), watch = process.argv.includes('--watch');
const circleCovers = process.argv.includes('--circle-covers');
let processed = 0, failed = 0;
do {
  if (circleCovers) {
    const claim = await gateway.claimCircleCover();
    if (claim.status === 'idle') {
      if (!watch) break;
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    try {
      if (claim.status !== 'claimed') throw new Error('Circle cover unavailable');
      const { cover, thumb } = await encodeCircleCover(await gateway.download(claim.job), claim.job.originalBytes);
      if ((await gateway.completeCircleCover(claim.job, cover, thumb)).stored) processed++;
    } catch {
      failed++;
      process.exitCode = 1;
    }
    console.log(JSON.stringify({ processed, failed }));
    continue;
  }
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
