import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { imageObject, type ImageSize } from '@/lib/imageAsset';
import { IMAGE_URL_TTL, imageStorageOrigin, loadImageAsset, requestImageRecovery, signImageObject } from '@/lib/imageStorage';

/** URL state is account scoped, renewed, and excluded from persisted queries. */
export function useImagePreview(reference: string, size: ImageSize = 'display', enabled = true) {
  const { user } = useUser();
  let object: ReturnType<typeof imageObject> = null;
  let invalid = false;
  try { object = imageObject(reference, imageStorageOrigin()); } catch { invalid = true; }
  const key = object ? `${object.bucket}:${object.path}` : reference;
  const query = useQuery({
    queryKey: ['image-preview', user?.id, key, size],
    enabled: enabled && !!reference && !invalid && (!!user?.id || !object),
    staleTime: 60000, gcTime: 0, retry: 1,
    refetchInterval: q => q.state.data?.pending ? 3000 : q.state.data?.failed ? 15000 : (IMAGE_URL_TTL - 60) * 1000,
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      if (!object) return { url: reference, asset: null, pending: false, failed: false, expiresAt: Infinity };
      const asset = await loadImageAsset(reference);
      if (asset && asset.status !== 'ready') return { url: '', asset, pending: asset.status !== 'failed', failed: asset.status === 'failed', expiresAt: 0 };
      const path = asset ? asset.variants[size]?.path : object.path;
      // A registered asset never falls back to fetching its original implicitly.
      if (!path) throw new Error('Image preview unavailable');
      const url = await signImageObject(object.bucket, path);
      return { url, asset, pending: false, failed: false, expiresAt: Date.now() + IMAGE_URL_TTL * 1000 };
    },
  });
  const data = query.data;
  return {
    url: data?.expiresAt > Date.now() ? data.url : '', asset: data?.asset,
    failed: invalid || query.isError || !!data?.failed,
    pending: !!data?.pending,
    retry: async () => {
      if (data?.asset?.status === 'failed' && data.asset) {
        try { await requestImageRecovery(data.asset.id); } catch { /* Refetch preserves the actual server failure state. */ }
      }
      await query.refetch();
    },
  };
}
