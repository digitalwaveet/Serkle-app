import { Upload } from 'tus-js-client';
import type { ResumableUploadInput } from './uploadWithProgress';

const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const RETRY_DELAYS = [0, 1_000, 3_000, 5_000, 10_000, 20_000];

const readableTusError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/network|fetch|connection|offline|failed to upload/i.test(message)) {
    return 'The connection was interrupted. Tap Retry upload to resume from the last completed chunk.';
  }
  return message || 'The resumable upload could not be completed.';
};

/**
 * Uploads directly to Supabase Storage's TUS endpoint. The signed token keeps
 * authorization scoped to one object while the browser can resume a partially
 * transferred video after a network interruption or retry.
 */
export function uploadResumableFile(input: ResumableUploadInput) {
  const {
    endpoint,
    bucketName,
    objectName,
    file,
    token,
    cacheControl = '3600',
    contentType = file.type || 'application/octet-stream',
    onProgress,
    signal,
    upsert = true,
  } = input;

  if (signal?.aborted) return Promise.reject(new DOMException('Upload cancelled', 'AbortError'));

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abortUpload);
      callback();
    };

    const upload = new Upload(file, {
      endpoint,
      retryDelays: RETRY_DELAYS,
      headers: {
        'x-signature': token,
        'x-upsert': String(upsert),
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: TUS_CHUNK_SIZE,
      metadata: {
        bucketName,
        objectName,
        contentType,
        cacheControl,
      },
      onProgress: (uploaded, total) => {
        if (total > 0) onProgress?.((uploaded / total) * 100);
      },
      onError: error => finish(() => reject(new Error(readableTusError(error)))),
      onSuccess: () => finish(resolve),
    });

    const abortUpload = () => {
      void upload.abort().finally(() => {
        finish(() => reject(new DOMException('Upload cancelled', 'AbortError')));
      });
    };
    signal?.addEventListener('abort', abortUpload, { once: true });

    upload.findPreviousUploads()
      .then(previous => {
        if (settled) return;
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(error => finish(() => reject(new Error(readableTusError(error)))));
  });
}

export function supabaseResumableEndpoint(supabaseUrl: string) {
  const url = new URL(supabaseUrl);
  const projectRef = url.hostname.endsWith('.supabase.co') ? url.hostname.split('.')[0] : null;
  return projectRef
    ? `${url.protocol}//${projectRef}.storage.supabase.co/storage/v1/upload/resumable`
    : new URL('/storage/v1/upload/resumable', url).toString();
}
