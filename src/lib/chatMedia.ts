import { supabase } from '@/integrations/supabase/client';

export const CHAT_MEDIA_BUCKET = 'chat-media';
export const CHAT_MEDIA_TTL = 300;
const PREFIX = 'chat-media://';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function privateChatPath(reference: string): string | null {
  if (!reference.startsWith(PREFIX)) return null;
  const path = reference.slice(PREFIX.length);
  const parts = path.split('/');
  if (parts.length !== 3 || !UUID.test(parts[0]) || !UUID.test(parts[1]) || !/^[a-zA-Z0-9_.-]+$/.test(parts[2]) || parts[2] === '.' || parts[2] === '..') {
    throw new Error('Invalid private attachment reference');
  }
  return path;
}

export async function uploadChatMedia(conversationId: string, file: Blob, filename = 'attachment'): Promise<string> {
  if (!UUID.test(conversationId)) throw new Error('Invalid conversation');
  if (file.size > 50 * 1024 * 1024) throw new Error('Chat attachments must be 50 MB or smaller');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sign in again to upload attachments');
  const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-100) || 'attachment';
  const path = `${conversationId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, { upsert: false });
  if (error) throw new Error('Private upload unavailable. Check chat storage setup or your access and try again.');
  // Persist only a stable reference. Never persist a bearer/signed URL.
  return `${PREFIX}${path}`;
}

export async function resolveChatMedia(reference: string): Promise<string> {
  const path = privateChatPath(reference);
  if (!path) return reference;
  const { data, error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).createSignedUrl(path, CHAT_MEDIA_TTL);
  if (error || !data?.signedUrl) throw new Error('Attachment unavailable or access expired');
  return data.signedUrl;
}

export async function copyChatMediaToConversation(reference: string, conversationId: string): Promise<string> {
  let path = privateChatPath(reference);
  let bucket = CHAT_MEDIA_BUCKET;
  if (!path) {
    // Legacy public chat files must be copied into the destination's private
    // namespace, never forwarded as a public URL or a source-conversation token.
    const ownOrigin = new URL(supabase.storage.from('post-media').getPublicUrl('origin-check').data.publicUrl).origin;
    const url = new URL(reference);
    const marker = '/storage/v1/object/public/post-media/';
    if (url.origin !== ownOrigin || !url.pathname.startsWith(marker)) {
      throw new Error('Reattach this legacy file to forward it privately');
    }
    path = decodeURIComponent(url.pathname.slice(marker.length));
    if (path.split('/').some(part => part === '..' || part === '.')) throw new Error('Invalid attachment path');
    bucket = 'post-media';
  }
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error('Cannot access the original attachment');
  return uploadChatMedia(conversationId, data, path.split('/').pop());
}
