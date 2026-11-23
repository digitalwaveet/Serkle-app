import { supabase } from '@/integrations/supabase/client';
import { storageObjectFromUrl } from './storageReference';

const PROTECTED_BUCKETS = ['post-media', 'circle-videos', 'circle-resources'] as const;
const MEDIA_URL = /https?:\/\/[^\s"'<>]+\/storage\/v1\/object\/(?:public|sign|authenticated)\/(?:post-media|circle-videos|circle-resources)\/[^\s"'<>]+/g;

/** Resolve legacy URLs (including rich-text attachments) through object RLS.
 * Signing failures never fall back to a public URL. Tokens last only 60 seconds. */
export async function signProtectedMedia<T>(value: T): Promise<T> {
  const origin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
  const urls = new Set<string>();
  const visit = (item: unknown) => {
    if (typeof item === 'string') {
      for (const url of item.match(MEDIA_URL) || []) {
        if (storageObjectFromUrl(url, origin, PROTECTED_BUCKETS)) urls.add(url);
      }
    } else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  const replacements = new Map<string, string | null>();
  await Promise.all([...urls].map(async url => {
    const object = storageObjectFromUrl(url, origin, PROTECTED_BUCKETS)!;
    const { data, error } = await supabase.storage.from(object.bucket).createSignedUrl(object.path, 60);
    replacements.set(url, error ? null : data.signedUrl);
  }));
  const replace = (item: unknown): unknown => {
    if (typeof item === 'string') {
      if (replacements.has(item)) return replacements.get(item);
      let next = item;
      for (const [url, signed] of replacements) next = next.replaceAll(url, signed || '');
      return next;
    }
    if (Array.isArray(item)) return item.map(replace);
    if (item && typeof item === 'object')
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, replace(child)]));
    return item;
  };
  return replace(value) as T;
}
