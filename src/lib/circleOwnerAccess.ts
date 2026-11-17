import { supabase } from '@/integrations/supabase/client';

type CirclePostRow = {
  post_id: string;
  circle_id?: string | null;
  is_premium?: boolean | null;
  user_has_unlocked?: boolean | null;
  [key: string]: unknown;
};

/** Restore original payloads only when the owner-only server RPC confirms that
 * the authenticated viewer is the post author or Circle creator. */
export async function restoreOwnedCirclePostPayloads<T extends CirclePostRow>(rows: T[]): Promise<T[]> {
  const candidates = rows
    .filter(row => row.circle_id && row.is_premium && !row.user_has_unlocked)
    .map(row => row.post_id);
  if (!candidates.length) return rows;

  const { data, error } = await supabase.rpc('get_owned_circle_post_payloads' as any, {
    _post_ids: candidates,
  });
  if (error || !Array.isArray(data) || !data.length) return rows;

  const payloads = new Map(data.map((payload: any) => [payload.post_id, payload]));
  return rows.map(row => {
    const payload = payloads.get(row.post_id);
    return payload ? { ...row, ...payload, user_has_unlocked: true } : row;
  });
}
