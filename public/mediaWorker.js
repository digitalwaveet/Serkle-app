/**
 * Progressive Media Web Worker
 * Handles off-thread image compression and PDF processing.
 */

self.onmessage = async (e) => {
  const { id, buffer, type, fileName, stage } = e.data;

  try {
    if (type.startsWith('image/')) {
      const blob = new Blob([buffer], { type });
      const imgBitmap = await createImageBitmap(blob);
      
      const width = imgBitmap.width;
      const height = imgBitmap.height;
      
      // Target dimensions
      let targetWidth = stage === 'preview' ? 80 : 1200;
      let targetHeight = (height / width) * targetWidth;

      // Ensure we don't upscale
      if (width < targetWidth) {
        targetWidth = width;
        targetHeight = height;
      }

      const canvas = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgBitmap, 0, 0, targetWidth, targetHeight);

      const quality = stage === 'preview' ? 0.2 : 0.88;
      const compressedBlob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality
      });

      self.postMessage({
        id,
        stage,
        blob: compressedBlob,
        originalSize: buffer.byteLength,
        previewSize: compressedBlob.size
      });
    } else if (type === 'application/pdf') {
      let finalBlob;
      if (stage === 'preview') {
        // Just slice the header for a "preview" moment
        const previewBuffer = buffer.slice(0, 50 * 1024);
        finalBlob = new Blob([previewBuffer], { type });
      } else {
        finalBlob = new Blob([buffer], { type });
      }

      self.postMessage({
        id,
        stage,
        blob: finalBlob,
        originalSize: buffer.byteLength,
        previewSize: finalBlob.size
      });
    } else {
      throw new Error('Unsupported media type');
    }
  } catch (error) {
    self.postMessage({
      id,
      stage,
      error: error.message
    });
  }
};
