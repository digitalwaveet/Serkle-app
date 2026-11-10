export const IMAGE_PREVIEW_MARKER = '.__serkle_preview_v1_';
export const IMAGE_PRESETS = {
  thumb: { edge: 360, quality: 0.76 },
  display: { edge: 1280, quality: 0.8 },
  full: { edge: 1920, quality: 0.82 },
} as const;
export type ImageSize = keyof typeof IMAGE_PRESETS;
export const IMAGE_SIZES = Object.keys(IMAGE_PRESETS) as ImageSize[];
export const IMAGE_BYTE_LIMIT = 50 * 1024 * 1024;

export function previewPath(original: string, size: ImageSize) {
  return `${original}${IMAGE_PREVIEW_MARKER}${size}.webp`;
}

export function isImageId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}

export interface ImagePreviewJob {
  assetId: string;
  lease: string;
  originalUrl: string;
  originalBytes: number;
  originalSha256: string | null;
}

export interface ImagePreviewResult {
  width: number;
  height: number;
  animated: boolean;
  variants: Record<ImageSize, { width: number; height: number }>;
}

export type ImageClaim =
  | { status: 'claimed'; job: ImagePreviewJob }
  | { status: 'ready' | 'pending' | 'idle' };

export interface CircleCoverJob {
  postId: string;
  lease: string;
  originalUrl: string;
  originalBytes: number;
}

export type CircleCoverClaim = { status: 'claimed'; job: CircleCoverJob } | { status: 'idle' | 'unavailable' };
