import { encodeImagePreviews } from '../lib/imagePreviewCodec';
self.onmessage = async (event: MessageEvent<Blob>) => {
  try { self.postMessage({ previews: await encodeImagePreviews(event.data) }); }
  catch { self.postMessage({ error: 'Image preview processing failed' }); }
};
