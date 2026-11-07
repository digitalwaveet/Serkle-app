import type { SupabaseClient } from "@supabase/supabase-js";
export interface ChatDeliveryPayload {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  attachment_url: string | null;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  forwarded_from_name?: string;
}
export interface ChatDeliveryReceipt extends ChatDeliveryPayload {
  seq?: number;
  created_seq?: number;
}
/** A successful write response alone cannot prove which idempotent rows exist. */
export async function submitChatMessageBatch(
  client: Pick<SupabaseClient, "from">,
  payloads: ChatDeliveryPayload[],
): Promise<ChatDeliveryReceipt[]> {
  if (!payloads.length) return [];
  const { data: existing, error: lookupError } = await client
    .from("messages")
    .select("id")
    .in(
      "id",
      payloads.map((row) => row.id),
    );
  if (lookupError) throw lookupError;
  const stored = new Set((existing || []).map((row) => row.id));
  const pending = payloads.filter((row) => !stored.has(row.id));
  if (pending.length) {
    const { error } = await client
      .from("messages")
      .upsert(pending, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
  }
  const { data, error: readError } = await client
    .from("messages")
    .select(
      "id,conversation_id,sender_id,content,message_type,attachment_url,reply_to_id,created_at,updated_at,seq,created_seq",
    )
    .in(
      "id",
      payloads.map((row) => row.id),
    );
  if (readError) throw readError;
  const rows = (data || []) as ChatDeliveryReceipt[];
  if (
    payloads.some(
      (expected) =>
        !rows.some(
          (row) =>
            row.id === expected.id &&
            row.conversation_id === expected.conversation_id &&
            row.sender_id === expected.sender_id &&
            row.content === expected.content &&
            row.message_type === expected.message_type &&
            (row.attachment_url || null) ===
              (expected.attachment_url || null) &&
            (row.reply_to_id || null) === (expected.reply_to_id || null),
        ),
    )
  )
    throw Object.assign(new Error("Message delivery could not be confirmed"), {
      code: "ACK_UNCONFIRMED",
    });
  return rows;
}
export function chatDeliveryFailure(error: unknown) {
  const value =
    error && typeof error === "object"
      ? (error as { code?: string; status?: number; message?: string })
      : {};
  const code = value.code || "NETWORK_ERROR";
  if (
    value.status === 401 ||
    ["PGRST301", "PGRST303"].includes(code) ||
    /jwt.*expired|invalid.*jwt/i.test(value.message || "")
  )
    return {
      code,
      message:
        "Sign in again to send this message. It is still saved on this device.",
    };
  if (code === "42501")
    return {
      code,
      message:
        "You do not currently have permission to send to this conversation. Your message is saved.",
    };
  if (["PGRST202", "PGRST204", "42P01", "42883"].includes(code))
    return {
      code,
      message:
        "Messaging needs an app update. Your message is saved; retry after the update.",
    };
  return {
    code,
    message:
      "Message not sent. It is saved on this device. Check your connection and retry.",
  };
}
