import { fitImage, IMAGE_PRESETS, isAnimatedImage, type ImageSize } from './imageAsset';

export interface GeneratedPreview { blob: Blob; width: number; height: number }
export type GeneratedPreviews = Record<ImageSize, GeneratedPreview>;
export interface GeneratedImage { variants: GeneratedPreviews; width: number; height: number }

/** Runs in a worker where supported. Original bytes are never modified. */
export async function encodeImagePreviews(file: Blob): Promise<GeneratedImage | null> {
  if (isAnimatedImage(new Uint8Array(await file.arrayBuffer()), file.type)) return null;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (bitmap.width * bitmap.height > 50_000_000) throw new Error('Image exceeds 50 megapixels');
    const result = {} as GeneratedPreviews;
    for (const size of Object.keys(IMAGE_PRESETS) as ImageSize[]) {
      const { edge, quality } = IMAGE_PRESETS[size];
      const { width, height } = fitImage(bitmap.width, bitmap.height, edge);
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
      const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
      if (!context) throw new Error('Image processing unavailable');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, width, height);
      let blob = 'convertToBlob' in canvas
        ? await canvas.convertToBlob({ type: 'image/webp', quality })
        : await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Encoding failed')), 'image/webp', quality));
      // Safari can silently return PNG for a WebP request. Use the bundled
      // encoder rather than naming PNG/JPEG bytes with a .webp extension.
      if (blob.type !== 'image/webp') {
        const { encodeWebP } = await import('./webpEncoder');
        const data = await encodeWebP(context.getImageData(0, 0, width, height), quality * 100);
        blob = new Blob([data], { type: 'image/webp' });
      }
      result[size] = { blob, width, height };
    }
    return { variants: result, width: bitmap.width, height: bitmap.height };
  } finally { bitmap.close(); }
}
