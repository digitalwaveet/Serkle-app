const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface ChatStorageObject {
  bucket: "chat-media" | "post-media";
  path: string;
}
export function privateChatPath(reference: string): string | null {
  if (!reference.startsWith("chat-media://")) return null;
  const path = reference.slice("chat-media://".length),
    parts = path.split("/");
  if (
    parts.length !== 3 ||
    !UUID.test(parts[0]) ||
    !UUID.test(parts[1]) ||
    !/^[a-zA-Z0-9_.-]+$/.test(parts[2]) ||
    parts[2] === "." ||
    parts[2] === ".."
  )
    throw new Error("Invalid private attachment reference");
  return path;
}
/** Only this project's storage objects may be resolved using the current session. */
export function chatStorageObject(
  reference: string,
  origin: string,
): ChatStorageObject | null {
  const privatePath = privateChatPath(reference);
  if (privatePath) return { bucket: "chat-media", path: privatePath };
  let url: URL;
  try {
    url = new URL(reference);
  } catch {
    return null;
  }
  if (url.origin !== origin || url.username || url.password) return null;
  const rawPath = reference.replace(/^[a-z]+:\/\/[^/]+/i, "").split(/[?#]/)[0];
  const match = rawPath.match(
    /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/(post-media|chat-media)\/(.+)$/,
  );
  if (!match) return null;
  let path: string;
  try {
    path = decodeURIComponent(match[2]);
  } catch {
    throw new Error("Invalid attachment path");
  }
  if (
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    /[\x00-\x1f\\]/.test(path)
  )
    throw new Error("Invalid attachment path");
  if (match[1] === "chat-media") privateChatPath("chat-media://" + path);
  return { bucket: match[1] as ChatStorageObject["bucket"], path };
}
