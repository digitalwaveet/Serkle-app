export type UploadProgressHandler = (percent: number) => void;

type SignedUploadBucket = {
  createSignedUploadUrl: (
    path: string,
    options: { upsert: boolean },
  ) => Promise<{
    data: { signedUrl: string; token: string; path: string } | null;
    error: { message?: string } | null;
  }>;
};

export interface ProgressUploadOptions {
  cacheControl?: string;
  contentType?: string;
  onProgress?: UploadProgressHandler;
  signal?: AbortSignal;
  upsert?: boolean;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const uploadErrorMessage = (request: XMLHttpRequest) => {
  try {
    const payload = JSON.parse(request.responseText || '{}');
    return payload.message || payload.error || payload.statusCode || `Upload failed (${request.status})`;
  } catch {
    return request.responseText || `Upload failed (${request.status})`;
  }
};

/**
 * Uploads through a short-lived Supabase signed URL so browser-native XHR can
 * report real transmitted-byte progress. The signed URL is issued under the
 * current user's storage policy; no service-role credential reaches the client.
 */
export async function uploadFileWithProgress(
  bucket: SignedUploadBucket,
  path: string,
  file: Blob,
  options: ProgressUploadOptions = {},
) {
  const {
    cacheControl = '3600',
    onProgress,
    signal,
    upsert = true,
  } = options;
  let lastProgress = -1;
  const report = (value: number) => {
    const next = clampPercent(value);
    if (next === lastProgress) return;
    lastProgress = next;
    onProgress?.(next);
  };

  if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
  report(0);

  const { data, error } = await bucket.createSignedUploadUrl(path, { upsert });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not prepare the secure upload');
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      callback();
    };
    const abort = () => {
      request.abort();
      finish(() => reject(new DOMException('Upload cancelled', 'AbortError')));
    };

    request.open('PUT', data.signedUrl, true);
    request.setRequestHeader('x-upsert', String(upsert));
    request.upload.addEventListener('progress', event => {
      if (!event.lengthComputable || event.total <= 0) return;
      report((event.loaded / event.total) * 100);
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        finish(resolve);
      } else {
        finish(() => reject(new Error(uploadErrorMessage(request))));
      }
    });
    request.addEventListener('error', () => finish(() => reject(new Error('Network error while uploading'))));
    request.addEventListener('timeout', () => finish(() => reject(new Error('Upload timed out. Check your connection and retry.'))));
    request.addEventListener('abort', () => finish(() => reject(new DOMException('Upload cancelled', 'AbortError'))));
    signal?.addEventListener('abort', abort, { once: true });

    const body = new FormData();
    body.append('cacheControl', cacheControl);
    body.append('', file, 'name' in file && typeof file.name === 'string' ? file.name : 'upload');
    request.send(body);
  });

  report(100);
  return data;
}
