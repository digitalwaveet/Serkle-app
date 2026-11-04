import { supabase } from '@/integrations/supabase/client';

const MEDIA_URL = /https?:\/\/[^\s"'<>]+\/storage\/v1\/object\/public\/(?:post-media|circle-videos|circle-resources)\/[^\s"'<>]+/g;

/** Resolve legacy URLs (including rich-text attachments) through object RLS.
 * Signing failures never fall back to a public URL. Tokens last only 60 seconds. */
export async function signProtectedMedia<T>(value: T): Promise<T> {
  const origin = new URL(supabase.storage.from('post-media').getPublicUrl('origin').data.publicUrl).origin;
  const urls = new Set<string>();
  const visit = (item: unknown) => {
    if (typeof item === 'string') {
      for (const url of item.match(MEDIA_URL) || []) if (new URL(url).origin === origin) urls.add(url);
    } else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  const replacements = new Map<string, string | null>();
  await Promise.all([...urls].map(async url => {
    const match = url.match(/\/storage\/v1\/object\/public\/(post-media|circle-videos|circle-resources)\/(.*)$/)!;
    const { data, error } = await supabase.storage.from(match[1]).createSignedUrl(decodeURIComponent(match[2]), 60);
    replacements.set(url, error ? null : data.signedUrl);
  }));
  const replace = (item: unknown): unknown => {
    if (typeof item === 'string') {
      if (replacements.has(item)) return replacements.get(item);
      return item.replace(MEDIA_URL, url => replacements.has(url) ? replacements.get(url) || '' : url);
    }
    if (Array.isArray(item)) return item.map(replace);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, replace(v)]));
    return item;
  };
  return replace(value) as T;
}
