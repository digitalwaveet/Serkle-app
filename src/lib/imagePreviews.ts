import type { GeneratedImage } from './imagePreviewCodec';
import { isAnimatedImage } from './imageAsset';

export async function generateImagePreviews(file: File): Promise<GeneratedImage | null> {
  // HEIC conversion is for the preview only. The caller uploads the untouched
  // File first, so iPhone originals remain available for download.
  let input: Blob = file;
  if (isAnimatedImage(new Uint8Array(await file.arrayBuffer()), file.type)) return null;
  if (/image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/png' });
    input = Array.isArray(converted) ? converted[0] : converted;
  }
  if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  const worker = new Worker(new URL('../workers/imagePreviews.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<GeneratedImage | null>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Preview processing timed out')), 60000);
      worker.onmessage = event => {
        clearTimeout(timeout);
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.previews);
      };
      worker.onerror = () => { clearTimeout(timeout); reject(new Error('Preview worker unavailable')); };
      worker.postMessage(input);
    });
  } finally { worker.terminate(); }
}
