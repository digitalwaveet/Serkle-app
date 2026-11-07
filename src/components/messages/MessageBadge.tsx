import { formatMessageBadge, messageCount } from "@/lib/messagingPresentation";
export default function MessageBadge({
  count,
  className = "",
}: {
  count: number | null | undefined;
  className?: string;
}) {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0)
    return null;
  return (
    <span
      className={`msg-badge ${className}`}
      aria-label={messageCount(count, "unread message")}
    >
      {formatMessageBadge(count)}
    </span>
  );
}
