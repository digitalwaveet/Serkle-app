const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'public/lovable-uploads/SerkleMainLogo.svg');
const SVG_ASPECT = 374 / 253; // width / height

async function generatePwaIcon(size, outputPath) {
  // Safe zone for maskable icon is a circle of diameter 80%.
  // We make logo width 55% of canvas (0.55 * size) to fit comfortably with safe margins.
  const logoWidth = Math.round(size * 0.55);
  const logoHeight = Math.round(logoWidth / SVG_ASPECT);

  const resizedLogo = await sharp(SVG_PATH)
    .resize(logoWidth, logoHeight)
    .toBuffer();

  const icon = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite([{
    input: resizedLogo,
    top: Math.round((size - logoHeight) / 2),
    left: Math.round((size - logoWidth) / 2)
  }])
  .png()
  .toBuffer();

  fs.writeFileSync(outputPath, icon);
  console.log(`Generated: ${path.relative(ROOT, outputPath)} (${size}x${size}, logo: ${logoWidth}x${logoHeight})`);
}

async function generateAdaptiveForeground(canvasSize, outputPath) {
  // Google recommends adaptive icon graphic fits in a 44-48dp circle within the 108dp canvas (44.4% of canvas).
  // Inside the 72dp visible circular mask, this gives a comfortable ~70% proportional fit with breathing room.
  const logoWidth = Math.round(canvasSize * 0.444);
  const logoHeight = Math.round(logoWidth / SVG_ASPECT);

  const resizedLogo = await sharp(SVG_PATH)
    .resize(logoWidth, logoHeight)
    .toBuffer();

  const foreground = await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent
    }
  })
  .composite([{
    input: resizedLogo,
    top: Math.round((canvasSize - logoHeight) / 2),
    left: Math.round((canvasSize - logoWidth) / 2)
  }])
  .png()
  .toBuffer();

  fs.writeFileSync(outputPath, foreground);
  console.log(`Generated adaptive foreground: ${path.relative(ROOT, outputPath)} (${canvasSize}x${canvasSize}, logo: ${logoWidth}x${logoHeight})`);
}

async function generateLegacyIcon(size, isRound, outputPath) {
  const logoWidth = Math.round(size * 0.56);
  const logoHeight = Math.round(logoWidth / SVG_ASPECT);

  const resizedLogo = await sharp(SVG_PATH)
    .resize(logoWidth, logoHeight)
    .toBuffer();

  let baseImage;
  if (isRound) {
    const circleSvg = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#FFFFFF"/></svg>`
    );
    baseImage = await sharp(circleSvg).png().toBuffer();
  } else {
    const r = Math.round(size * 0.18);
    const rectSvg = Buffer.from(
      `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#FFFFFF"/></svg>`
    );
    baseImage = await sharp(rectSvg).png().toBuffer();
  }

  const icon = await sharp(baseImage)
    .composite([{
      input: resizedLogo,
      top: Math.round((size - logoHeight) / 2),
      left: Math.round((size - logoWidth) / 2)
    }])
    .png()
    .toBuffer();

  fs.writeFileSync(outputPath, icon);
  console.log(`Generated legacy icon (${isRound ? 'round' : 'square'}): ${path.relative(ROOT, outputPath)}`);
}

async function main() {
  console.log('--- Generating Proportional PWA & Android Icons ---');

  // 1. PWA public icons
  await generatePwaIcon(512, path.join(ROOT, 'public/icon-512.png'));
  await generatePwaIcon(192, path.join(ROOT, 'public/icon-192.png'));

  // 2. Android web assets (if present)
  const androidAssetsPublic = path.join(ROOT, 'android/app/src/main/assets/public');
  if (fs.existsSync(androidAssetsPublic)) {
    await generatePwaIcon(512, path.join(androidAssetsPublic, 'icon-512.png'));
    await generatePwaIcon(192, path.join(androidAssetsPublic, 'icon-192.png'));
  }

  // 3. Android mipmap densities
  const densities = [
    { name: 'mdpi', foregroundSize: 108, legacySize: 48 },
    { name: 'hdpi', foregroundSize: 162, legacySize: 72 },
    { name: 'xhdpi', foregroundSize: 216, legacySize: 96 },
    { name: 'xxhdpi', foregroundSize: 324, legacySize: 144 },
    { name: 'xxxhdpi', foregroundSize: 432, legacySize: 192 },
  ];

  for (const d of densities) {
    const dir = path.join(ROOT, `android/app/src/main/res/mipmap-${d.name}`);
    if (fs.existsSync(dir)) {
      // Foreground
      await generateAdaptiveForeground(d.foregroundSize, path.join(dir, 'ic_launcher_foreground.png'));
      // Legacy square
      await generateLegacyIcon(d.legacySize, false, path.join(dir, 'ic_launcher.png'));
      // Legacy round
      await generateLegacyIcon(d.legacySize, true, path.join(dir, 'ic_launcher_round.png'));
    }
  }

  console.log('--- All icons generated with clean proportions! ---');
}

main().catch(console.error);
