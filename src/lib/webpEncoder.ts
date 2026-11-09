import encode, { init } from '@jsquash/webp/encode';
import standard from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import simd from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';
let initialized: Promise<unknown>;
export async function encodeWebP(data: ImageData, quality: number) {
  initialized ||= init({ locateFile: path => path.includes('simd') ? simd : standard });
  await initialized;
  return encode(data, { quality });
}
