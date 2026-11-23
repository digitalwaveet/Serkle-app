export const RETIRED_SERKLE_STORAGE_ORIGINS = [
  'https://zewcewkqruxlniavsrgj.supabase.co',
] as const;

export interface StorageObjectReference<TBucket extends string = string> {
  bucket: TBucket;
  path: string;
}

export function isTrustedSerkleStorageOrigin(origin: string, activeOrigin: string) {
  return origin === activeOrigin || RETIRED_SERKLE_STORAGE_ORIGINS.includes(
    origin as (typeof RETIRED_SERKLE_STORAGE_ORIGINS)[number],
  );
}

/**
 * Parse a persisted Supabase Storage URL without trusting arbitrary third-party
 * hosts. The retired project is accepted only so restored rows can be resolved
 * through the active project's RLS and newly signed URLs.
 */
export function storageObjectFromUrl<TBucket extends string>(
  reference: string,
  activeOrigin: string,
  allowedBuckets: readonly TBucket[],
): StorageObjectReference<TBucket> | null {
  let url: URL;
  try {
    url = new URL(reference);
  } catch {
    return null;
  }
  if (
    url.username ||
    url.password ||
    !isTrustedSerkleStorageOrigin(url.origin, activeOrigin)
  ) return null;

  const authorityEnd = reference.indexOf('/', reference.indexOf('://') + 3);
  const rawPath = (authorityEnd >= 0 ? reference.slice(authorityEnd) : '/')
    .split(/[?#]/, 1)[0];
  const match = rawPath.match(
    /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
  );
  if (!match || !allowedBuckets.includes(match[1] as TBucket)) return null;

  let path: string;
  try {
    path = decodeURIComponent(match[2]);
  } catch {
    throw new Error('Invalid storage object path');
  }
  if (
    /[\x00-\x1f\\]/.test(path) ||
    path.split('/').some(part => !part || part === '.' || part === '..')
  ) throw new Error('Invalid storage object path');

  return { bucket: match[1] as TBucket, path };
}
