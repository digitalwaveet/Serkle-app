import { supabase } from "@/integrations/supabase/client";
import { chatStorageObject } from "./chatMediaReference";
export { privateChatPath } from "./chatMediaReference";

export const CHAT_MEDIA_BUCKET = "chat-media";
export const CHAT_MEDIA_TTL = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const storageOrigin = () =>
  new URL(
    supabase.storage.from("post-media").getPublicUrl("origin-check").data
      .publicUrl,
  ).origin;
export function requiresChatMediaResolution(reference: string) {
  try {
    return !!chatStorageObject(reference, storageOrigin());
  } catch {
    return true;
  }
}

export async function uploadChatMedia(
  conversationId: string,
  file: Blob,
  filename = "attachment",
): Promise<string> {
  if (!UUID.test(conversationId)) throw new Error("Invalid conversation");
  if (file.size > 50 * 1024 * 1024)
    throw new Error("Chat attachments must be 50 MB or smaller");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    throw new Error("Sign in again to upload attachments");
  const safeName =
    filename.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-100) || "attachment";
  const path = `${conversationId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(path, file, { upsert: false });
  if (error)
    throw new Error(
      "Private upload unavailable. Check chat storage setup or your access and try again.",
    );
  // Persist only a stable reference. Never persist a bearer/signed URL.
  return `chat-media://${path}`;
}

export async function resolveChatMedia(reference: string): Promise<string> {
  const object = chatStorageObject(reference, storageOrigin());
  if (!object) return reference;
  const { data, error } = await supabase.storage
    .from(object.bucket)
    .createSignedUrl(object.path, CHAT_MEDIA_TTL);
  if (error || !data?.signedUrl)
    throw new Error("Attachment unavailable or access expired");
  return data.signedUrl;
}

export async function copyChatMediaToConversation(
  reference: string,
  conversationId: string,
): Promise<string> {
  const object = chatStorageObject(reference, storageOrigin());
  if (!object)
    throw new Error("Reattach this legacy file to forward it privately");
  const { path, bucket } = object;
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error("Cannot access the original attachment");
  return uploadChatMedia(conversationId, data, path.split("/").pop());
}
