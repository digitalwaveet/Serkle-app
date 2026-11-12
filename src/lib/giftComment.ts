import { supabase } from '@/integrations/supabase/client';

export interface GiftCommentMetadata {
  giftId: string;
  name: string;
  emoji: string;
  image?: string;
  quantity: number;
  value: number;
  senderId: string;
  senderName?: string;
  transactionId: string;
}

export interface PendingGiftCommentRecord {
  requestId: string;
  transactionId: string;
  postId: string;
  userId: string;
  userName: string;
  giftId: string;
  giftName: string;
  giftEmoji: string;
  giftImage?: string;
  quantity: number;
  coinValue: number;
  createdAt: number;
}

export type GiftAnimationLevel = 'pop' | 'glow' | 'diamond' | 'celebration';

export interface GiftAnimationTierConfig {
  level: GiftAnimationLevel;
  durationMs: number;
  particleCount: number;
}

/**
 * Maps gift coin value to animation progression level and duration:
 * - 1–99 coins: Simple icon pop (500ms)
 * - 100–499 coins: Bounce and glow (900ms)
 * - 500–999 coins: Diamond-style sparkle burst (1,400ms)
 * - 1,000+ coins: Enhanced mini celebration (1,800ms)
 */
export function getGiftAnimationTier(coinValue: number): GiftAnimationTierConfig {
  if (coinValue >= 1000) {
    return { level: 'celebration', durationMs: 1800, particleCount: 10 };
  }
  if (coinValue >= 500) {
    return { level: 'diamond', durationMs: 1400, particleCount: 8 };
  }
  if (coinValue >= 100) {
    return { level: 'glow', durationMs: 900, particleCount: 6 };
  }
  return { level: 'pop', durationMs: 500, particleCount: 0 };
}

const GIFT_META_PREFIX = '[[GIFT_META:';
const GIFT_META_SUFFIX = ']]';

export function formatGiftCommentContent(meta: GiftCommentMetadata): string {
  const payload: GiftCommentMetadata = {
    giftId: meta.giftId,
    name: meta.name,
    emoji: meta.emoji,
    ...(meta.image ? { image: meta.image } : {}),
    quantity: meta.quantity || 1,
    value: meta.value,
    senderId: meta.senderId,
    ...(meta.senderName ? { senderName: meta.senderName } : {}),
    transactionId: meta.transactionId,
  };
  const labelText =
    payload.quantity > 1
      ? `Sent ${payload.quantity}× ${payload.name}`
      : `Sent a ${payload.name}`;
  return `${GIFT_META_PREFIX}${JSON.stringify(payload)}${GIFT_META_SUFFIX}${payload.emoji} ${labelText} (${payload.value} coins)`;
}

const LEGACY_GIFT_REGEX = /^(\S+)\s+sent a\s+(.+?)\s+gift\s+\((\d+)\s*🪙\)$/i;

export function parseGiftComment(content: string): GiftCommentMetadata | null {
  if (!content) return null;

  if (content.startsWith(GIFT_META_PREFIX)) {
    const endIdx = content.indexOf(GIFT_META_SUFFIX);
    if (endIdx > GIFT_META_PREFIX.length) {
      const rawJson = content.slice(GIFT_META_PREFIX.length, endIdx);
      try {
        const parsed = JSON.parse(rawJson) as GiftCommentMetadata;
        if (parsed && parsed.name && typeof parsed.value === 'number') {
          return {
            giftId: parsed.giftId || parsed.name.toLowerCase(),
            name: parsed.name,
            emoji: parsed.emoji || '💎',
            image: parsed.image,
            quantity: parsed.quantity || 1,
            value: parsed.value,
            senderId: parsed.senderId || '',
            senderName: parsed.senderName,
            transactionId: parsed.transactionId || '',
          };
        }
      } catch {
        // Fall through to legacy check
      }
    }
  }

  const legacyMatch = content.trim().match(LEGACY_GIFT_REGEX);
  if (legacyMatch) {
    const [, emoji, name, valueStr] = legacyMatch;
    return {
      giftId: name.trim().toLowerCase(),
      name: name.trim(),
      emoji,
      quantity: 1,
      value: Number(valueStr) || 0,
      senderId: '',
      transactionId: 'legacy',
    };
  }

  return null;
}

const PENDING_STORAGE_KEY = 'serkle:pending_gift_comments:v1';
const FINALIZED_STORAGE_KEY = 'serkle:finalized_gift_comments:v1';
const inFlightFinalizations = new Map<string, Promise<{ id: string; content: string } | null>>();

function readStorageMap<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function writeStorageMap<T>(key: string, map: Record<string, T>) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export function isGiftCommentFinalized(requestId: string): boolean {
  const finalized = readStorageMap<number>(FINALIZED_STORAGE_KEY);
  return Boolean(finalized[requestId]);
}

function markGiftCommentFinalized(requestId: string) {
  const finalized = readStorageMap<number>(FINALIZED_STORAGE_KEY);
  finalized[requestId] = Date.now();
  // Prune entries older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [k, ts] of Object.entries(finalized)) {
    if (ts < cutoff) delete finalized[k];
  }
  writeStorageMap(FINALIZED_STORAGE_KEY, finalized);
}

export function savePendingGiftComment(record: PendingGiftCommentRecord) {
  const map = readStorageMap<PendingGiftCommentRecord>(PENDING_STORAGE_KEY);
  map[record.requestId] = record;
  writeStorageMap(PENDING_STORAGE_KEY, map);
}

export function removePendingGiftComment(requestId: string) {
  const map = readStorageMap<PendingGiftCommentRecord>(PENDING_STORAGE_KEY);
  if (map[requestId]) {
    delete map[requestId];
    writeStorageMap(PENDING_STORAGE_KEY, map);
  }
}

export function getPendingGiftCommentsForPost(postId: string, userId?: string): PendingGiftCommentRecord[] {
  const map = readStorageMap<PendingGiftCommentRecord>(PENDING_STORAGE_KEY);
  return Object.values(map).filter(
    (item) => item.postId === postId && (!userId || item.userId === userId)
  );
}

/**
 * Idempotently publishes a paid gift comment to the `comments` table.
 * Prevents duplicate comments for the same transaction/requestId and retries safely on failure.
 */
export async function finalizePendingGiftComment(
  record: PendingGiftCommentRecord
): Promise<{ id: string; content: string } | null> {
  if (isGiftCommentFinalized(record.requestId)) {
    removePendingGiftComment(record.requestId);
    return null;
  }

  const existingPromise = inFlightFinalizations.get(record.requestId);
  if (existingPromise) {
    return existingPromise;
  }

  const task = (async () => {
    const content = formatGiftCommentContent({
      giftId: record.giftId,
      name: record.giftName,
      emoji: record.giftEmoji,
      image: record.giftImage,
      quantity: record.quantity,
      value: record.coinValue,
      senderId: record.userId,
      senderName: record.userName,
      transactionId: record.transactionId || record.requestId,
    });

    try {
      // Check if this transaction's gift comment was already inserted (e.g., by unload beacon or prior retry)
      const { data: existingRows } = await supabase
        .from('comments')
        .select('id, content')
        .eq('post_id', record.postId)
        .eq('user_id', record.userId)
        .ilike('content', `%${record.transactionId || record.requestId}%`)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        markGiftCommentFinalized(record.requestId);
        removePendingGiftComment(record.requestId);
        return existingRows[0];
      }

      // Insert the finalized gift comment
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: record.postId,
          user_id: record.userId,
          content,
          parent_id: null,
        })
        .select('id, content')
        .single();

      if (error) throw error;

      markGiftCommentFinalized(record.requestId);
      removePendingGiftComment(record.requestId);
      return data;
    } catch (err) {
      console.error('Error finalizing paid gift comment (will retry/recover):', err);
      return null;
    } finally {
      inFlightFinalizations.delete(record.requestId);
    }
  })();

  inFlightFinalizations.set(record.requestId, task);
  return task;
}

/**
 * Fallback finalization if the user closes the tab/app before the animation finishes.
 * Uses keepalive fetch to Supabase REST API so the request completes even during page unload.
 */
export function flushPendingGiftCommentKeepalive(record: PendingGiftCommentRecord) {
  if (isGiftCommentFinalized(record.requestId)) return;

  // Trigger standard async finalizer
  void finalizePendingGiftComment(record);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    // Find current session access token from localStorage if available
    let accessToken = supabaseKey;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.access_token) {
            accessToken = parsed.access_token;
            break;
          }
        }
      }
    }

    const content = formatGiftCommentContent({
      giftId: record.giftId,
      name: record.giftName,
      emoji: record.giftEmoji,
      image: record.giftImage,
      quantity: record.quantity,
      value: record.coinValue,
      senderId: record.userId,
      senderName: record.userName,
      transactionId: record.transactionId || record.requestId,
    });

    markGiftCommentFinalized(record.requestId);
    removePendingGiftComment(record.requestId);

    void fetch(`${supabaseUrl}/rest/v1/comments`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        post_id: record.postId,
        user_id: record.userId,
        content,
        parent_id: null,
      }),
    });
  } catch {
    // If keepalive fails, the pending record remains in storage for recovery
  }
}

