import { storageObjectFromUrl } from './storageReference';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ChatStorageObject {
  bucket: 'chat-media' | 'post-media';
  path: string;
}

export function privateChatPath(reference: string): string | null {
  if (!reference.startsWith('chat-media://')) return null;
  const path = reference.slice('chat-media://'.length);
  const parts = path.split('/');
  if (
    parts.length !== 3 ||
    !UUID.test(parts[0]) ||
    !UUID.test(parts[1]) ||
    !/^[a-zA-Z0-9_.-]+$/.test(parts[2]) ||
    parts[2] === '.' ||
    parts[2] === '..'
  ) throw new Error('Invalid private attachment reference');
  return path;
}

/** Only the active or explicitly retired Serkle storage project may be resolved. */
export function chatStorageObject(
  reference: string,
  origin: string,
): ChatStorageObject | null {
  const privatePath = privateChatPath(reference);
  if (privatePath) return { bucket: 'chat-media', path: privatePath };
  const object = storageObjectFromUrl(
    reference,
    origin,
    ['post-media', 'chat-media'] as const,
  );
  if (!object) return null;
  if (object.bucket === 'chat-media') privateChatPath(`chat-media://${object.path}`);
  return object;
}
