import React from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
export function AskLoading({
  label = "Loading questions",
}: {
  label?: string;
}) {
  return (
    <div className="ask-state">
      <SerkleLoader size="sm" label={label} showText />
    </div>
  );
}
export function AskState({
  title,
  description,
  onRetry,
  retryLabel = "Try again",
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="ask-state">
      <span className="ask-state-icon">
        <MessageCircle aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {onRetry && (
        <button className="ask-button ask-button--secondary" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
