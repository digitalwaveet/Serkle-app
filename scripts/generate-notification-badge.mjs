// Rasterize the existing vector mark as a monochrome notification badge.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const source = readFileSync(new URL('../public/lovable-uploads/SerkleMainLogo.svg', import.meta.url), 'utf8');
const monochrome = source.replace(/fill="url\(#[^)]+\)"/g, 'fill="#ffffff"');
await sharp(Buffer.from(monochrome)).resize(54, 54, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 9, bottom: 9, left: 9, right: 9, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(fileURLToPath(new URL('../public/badge-72.png', import.meta.url)));
