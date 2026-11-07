import { MessageCircle } from "lucide-react";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
export function MessagingLoading({
  label = "Loading messages",
}: {
  label?: string;
}) {
  return (
    <div className="msg-state">
      <SerkleLoader label={label} showText />
    </div>
  );
}
export function MessagingState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="msg-state">
      <MessageCircle aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && (
        <button className="msg-button secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
