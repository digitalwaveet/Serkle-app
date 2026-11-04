import { useEffect, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { resolveChatMedia, CHAT_MEDIA_TTL } from '@/lib/chatMedia';

// Signed URLs are ephemeral component state, not persisted in Dexie or the
// persisted query cache. Scope state to the account and renew before expiry.
export function useChatMediaUrls(sources: (string | null | undefined)[], enabled = true) {
  const { user } = useUser();
  const sourceKey = JSON.stringify([...new Set(sources.filter((s): s is string => !!s && s.startsWith('chat-media://')))].sort());
  const key = `${user?.id || ''}:${enabled}:${sourceKey}`;
  const [state, setState] = useState<{ key: string; urls: Record<string, string>; errors: string[]; expiresAt: number }>({ key: '', urls: {}, errors: [], expiresAt: 0 });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !user?.id || sourceKey === '[]') return;
    let cancelled = false;
    let refreshing = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      clearTimeout(timer);
      const expiresAt = Date.now() + CHAT_MEDIA_TTL * 1000;
      const refs: string[] = JSON.parse(sourceKey);
      const results = await Promise.allSettled(refs.map(resolveChatMedia));
      refreshing = false;
      if (cancelled) return;
      const urls: Record<string, string> = {};
      const errors: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') urls[refs[index]] = result.value;
        else errors.push(refs[index]);
      });
      setState({ key, urls, errors, expiresAt });
      timer = setTimeout(refresh, Math.max(1000, expiresAt - Date.now() - 60000));
    };
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener('focus', onFocus); };
  }, [sourceKey, user?.id, enabled, key, attempt]);
  const current = state.key === key && state.expiresAt > Date.now() ? state : { urls: {}, errors: [] };
  return {
    url: (source?: string | null) => source?.startsWith('chat-media://') ? current.urls[source] || '' : source || '',
    failed: (source?: string | null) => !!source && current.errors.includes(source),
    retry: () => setAttempt(value => value + 1),
  };
}
