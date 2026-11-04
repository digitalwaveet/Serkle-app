import * as pdfjs from 'pdfjs-dist';

// Use Vite's ?url import to get a reliable local URL for the worker.
// This avoids the 'failed to fetch worker' error common with CDNs in Vite/Capacitor apps.
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PDFPageImage {
  blob: Blob;
  width: number;
  height: number;
  pageNumber: number;
}

/**
 * Converts a PDF file into a list of images (one per page)
 */
export const renderPDFToImages = async (
  file: File, 
  onProgress?: (current: number, total: number) => void
): Promise<PDFPageImage[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const images: PDFPageImage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // Use 2x scale for higher quality

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create canvas context');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/webp', 0.8);
    });

    images.push({
      blob,
      width: viewport.width,
      height: viewport.height,
      pageNumber: i,
    });

    onProgress?.(i, numPages);
  }

  return images;
};
/**
 * Fetches a PDF from a URL and renders the first page as a Blob
 */
export const getPdfThumbnail = async (url: string): Promise<Blob> => {
  try {
    // We use getDocument with the URL directly
    // pdfjs handles range requests if the server supports them
    const loadingTask = pdfjs.getDocument(url);
    const pdf = await loadingTask.promise;
    
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 }); // 1.5x scale for decent preview quality

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create canvas context');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/webp', 0.8);
    });
  } catch (err) {
    console.error('[pdfUtils] Failed to generate thumbnail:', err);
    throw err;
  }
};
