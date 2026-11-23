import { Upload } from 'tus-js-client';
import type { ResumableUploadInput } from './uploadWithProgress';

const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const RETRY_DELAYS = [0, 1_000, 3_000, 5_000, 10_000, 20_000];

const readableTusError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/network|fetch|connection|offline|failed to upload/i.test(message)) {
    return 'The connection was interrupted. Tap Retry upload to resume from the last completed chunk.';
  }
  if (/invalid compact jws|invalidjwt|unauthorized|accessdenied/i.test(message)) {
    return 'Your sign-in session could not authorize this upload. Tap Retry upload to refresh it and continue.';
  }
  return message || 'The resumable upload could not be completed.';
};

/**
 * Uploads directly to Supabase Storage's TUS endpoint. Every TUS request gets
 * the current user's access token so long uploads survive an auth refresh while
 * Storage RLS continues to scope the user to their own object path.
 */
export function uploadResumableFile(input: ResumableUploadInput) {
  const {
    endpoint,
    bucketName,
    objectName,
    file,
    getAccessToken,
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
        'x-upsert': String(upsert),
      },
      onBeforeRequest: async request => {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error('Your sign-in session has expired. Please sign in again.');
        request.setHeader('authorization', `Bearer ${accessToken}`);
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
