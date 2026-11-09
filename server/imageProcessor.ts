import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { detectImageMime, fitImage } from '../src/lib/imageAsset.ts';
import { IMAGE_PRESETS, IMAGE_SIZES, type ImagePreviewJob, type ImagePreviewResult } from '../supabase/functions/_shared/imagePreviewProtocol.ts';
import type { ImagePreviewStorage } from './imagePreviewGateway.ts';

/** Same dimensions/qualities as the client, with animation and EXIF support.
 * Sharp removes EXIF/GPS from previews by default; original bytes stay intact. */
export async function processImageAsset(storage: ImagePreviewStorage, job: ImagePreviewJob) {
  try {
    const data = await storage.download(job);
    if (data.size !== job.originalBytes) throw new Error('Original unavailable');
    const bytes = Buffer.from(await data.arrayBuffer());
    if (!detectImageMime(bytes.subarray(0, 64))) throw new Error('Unsupported image format');
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (job.originalSha256 && job.originalSha256 !== hash) throw new Error('Original integrity check failed');
    const metadata = await sharp(bytes, { animated: true, limitInputPixels: 50_000_000 }).metadata();
    const frames = metadata.pages || 1;
    let width = metadata.width!, height = metadata.pageHeight || metadata.height!;
    if (!width || !height || width * height * frames > 100_000_000 || frames > 240) throw new Error('Image processing limit exceeded');
    if ([5, 6, 7, 8].includes(metadata.orientation || 0)) [width, height] = [height, width];
    const variants = {} as ImagePreviewResult['variants'];
    // Process serially to bound memory use on phone-sized images and animations.
    for (const size of IMAGE_SIZES) {
      const preset = IMAGE_PRESETS[size], dimensions = fitImage(width, height, preset.edge);
      const output = await sharp(bytes, { animated: true, limitInputPixels: 50_000_000 })
        .rotate().resize({ width: dimensions.width, height: dimensions.height, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: Math.round(preset.quality * 100), effort: 4 }).toBuffer();
      await storage.upload(job, size, output);
      variants[size] = dimensions;
    }
    await storage.complete(job, { width, height, variants, animated: frames > 1 });
    return { status: 'ready' as const };
  } catch {
    await storage.fail(job).catch(() => {});
    // Do not expose filenames, signed URLs, decoder errors or service credentials.
    throw new Error('Preview processing failed. The original is retained.');
  }
}
