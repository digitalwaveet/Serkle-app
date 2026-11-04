import { createStore, get, set, del, entries, update } from 'idb-keyval';

export const SHARE_TTL = 60 * 60 * 1000;
export const SHARE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export type ShareDraft = { id: string; createdAt: number; text: string; files: File[]; owner?: string };
const store = createStore('serkle-share-inbox', 'drafts');
export const validShareId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function parseShare(form: FormData): Promise<Omit<ShareDraft, 'id' | 'createdAt'>> {
  const field = (key: string, max: number) => {
    const value = form.get(key);
    if (value !== null && typeof value !== 'string') throw new Error('Invalid share field');
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length > max) throw new Error('Shared text is too long');
    return text;
  };
  const title = field('title', 300);
  const text = field('text', 20000);
  const url = field('url', 2000);
  if (url && !['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('Unsupported link');
  const files = form.getAll('files').filter(value => typeof value !== 'string' && value.size > 0) as File[];
  if (files.length > 5 || files.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024) throw new Error('Share is too large');
  for (const file of files) {
    if (!SHARE_TYPES.includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Unsupported image or image too large');
    // Verify signatures, not just the sender-supplied MIME type. SVG/HTML is not accepted.
    const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const png = b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10;
    const jpg = b[0] === 255 && b[1] === 216 && b[2] === 255;
    const webp = String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
    if (!(file.type === 'image/png' ? png : file.type === 'image/jpeg' ? jpg : webp)) throw new Error('Invalid image');
  }
  const combined = [...new Set([title, text, url].filter(Boolean))].join('\n\n');
  if (!combined && !files.length) throw new Error('Nothing was shared');
  return { text: combined, files };
}

export async function pruneShareDrafts() {
  const saved = await entries<string, ShareDraft>(store);
  await Promise.all(saved.filter(([, draft]) => Date.now() - draft.createdAt >= SHARE_TTL).map(([id]) => del(id, store)));
}

export async function saveShareDraft(form: FormData) {
  const data = await parseShare(form);
  await pruneShareDrafts();
  // Reject rather than silently overwrite another pending share.
  if ((await entries(store)).length >= 3) throw new Error('Finish or discard an earlier share first');
  const draft: ShareDraft = { ...data, id: crypto.randomUUID(), createdAt: Date.now() };
  await set(draft.id, draft, store);
  return draft.id;
}

export async function readShareDraft(id: string, userId: string): Promise<ShareDraft | undefined> {
  if (!validShareId(id)) return;
  await pruneShareDrafts();
  const draft = await get<ShareDraft>(id, store);
  if (!draft || (draft.owner && draft.owner !== userId)) return;
  // Claim on first authenticated review; never show it to a different account.
  let claimed: ShareDraft | undefined;
  await update<ShareDraft>(id, current => {
    if (!current || (current.owner && current.owner !== userId)) return current;
    claimed = { ...current, owner: userId };
    return claimed;
  }, store);
  return claimed;
}

export async function removeShareDraft(id: string, userId: string) {
  const draft = await get<ShareDraft>(id, store);
  if (draft?.owner && draft.owner !== userId) throw new Error('This draft belongs to another account');
  await del(id, store);
}

export function shareReturnPath(search: string) {
  const target = new URLSearchParams(search).get('returnTo') || '';
  return /^\/share\?draft=[0-9a-f-]{36}$/i.test(target) ? target : '/';
}
