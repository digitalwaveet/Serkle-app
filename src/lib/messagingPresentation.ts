export function formatMessageBadge(count: number) {
  return count > 99 ? "99+" : new Intl.NumberFormat().format(count);
}
export function messageCount(
  count: number | null | undefined,
  singular: string,
  plural = `${singular}s`,
) {
  if (typeof count !== "number" || !Number.isFinite(count))
    return `— ${plural}`;
  return `${new Intl.NumberFormat().format(count)} ${count === 1 ? singular : plural}`;
}
export function messageDate(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value),
    today = new Date();
  return new Intl.DateTimeFormat(
    undefined,
    date.toDateString() === today.toDateString()
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" },
  ).format(date);
}
export interface SharedMessage {
  id: string;
  content?: string;
  message_type?: string;
  attachment_url?: string | null;
  conversation_id?: string;
  sender_id?: string;
  created_at?: string;
  deleted_for_everyone?: boolean;
}
export function categorizeChatContent(messages: SharedMessage[]) {
  const result = {
    media: [] as SharedMessage[],
    files: [] as SharedMessage[],
    audio: [] as SharedMessage[],
    voice: [] as SharedMessage[],
    links: [] as { id: string; url: string; messageId: string }[],
  };
  for (const message of messages) {
    if (message.deleted_for_everyone) continue;
    const type = message.message_type || "text";
    // Categorize using the durable attachment reference, before a signed URL loads.
    if (message.attachment_url) {
      if (["photo", "image", "video"].includes(type))
        result.media.push(message);
      else if (["file", "document", "pdf"].includes(type))
        result.files.push(message);
      else if (type === "audio") result.audio.push(message);
      else if (type === "voice") result.voice.push(message);
    }
    for (const match of message.content?.match(/https?:\/\/[^\s<>]+/g) || []) {
      const url = match.replace(/[),.!?;]+$/, "");
      try {
        if (["http:", "https:"].includes(new URL(url).protocol))
          result.links.push({
            id: `${message.id}-${result.links.length}`,
            url,
            messageId: message.id,
          });
      } catch {
        /* Invalid links are plain text. */
      }
    }
  }
  return result;
}
