import React, { useState } from "react";
import { ThumbsUp, Plus, GitBranch } from "lucide-react";
import { AnonymousAvatar } from "./AnonymousAvatar";
import {
  formatAskCount,
  formatAskNumber,
  askCategory,
} from "@/lib/askPresentation";
import "./ask.css";
interface ThreadUpdate {
  id: string;
  content: string;
  timestamp: string;
  upvotes: number;
  isOriginalPoster: boolean;
}
interface AnonymousThread {
  id: string;
  originalQuestion: string;
  category: string;
  tags: string[];
  timestamp: string;
  upvotes: number;
  isUrgent: boolean;
  hasExpertAnswer: boolean;
  updates: ThreadUpdate[];
  canContinue: boolean;
}
export function AnonymousThreadComponent({
  thread,
  onContinueThread,
  onUpvote,
}: {
  thread: AnonymousThread;
  onContinueThread?: () => void;
  onUpvote?: (updateId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const updates = expanded ? thread.updates : thread.updates.slice(0, 2);
  return (
    <section className="ask-ui ask-thread">
      <div className="ask-thread-head">
        <div className="ask-author">
          <span className="ask-author-avatar">
            <AnonymousAvatar pseudonym="Anonymous" size={36} />
          </span>
          <div className="ask-author-copy">
            <span className="ask-author-name">Anonymous</span>
            <p>{thread.timestamp}</p>
          </div>
          <span className="ask-category">{askCategory(thread.category)}</span>
        </div>
        <h3>{thread.originalQuestion}</h3>
        <div className="ask-counts">
          <span className="inline-flex gap-1 items-center">
            <GitBranch className="size-4" aria-hidden="true" />
            {formatAskCount(thread.updates.length, "update")}
          </span>
          <span>{formatAskCount(thread.upvotes, "upvote")}</span>
        </div>
      </div>
      {thread.updates.length > 0 && (
        <div className="ask-thread-updates">
          {updates.map((update) => (
            <article key={update.id} className="ask-thread-update">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <strong className="text-sm font-medium">
                    {update.isOriginalPoster
                      ? "Original poster"
                      : "Community member"}
                  </strong>
                  <p className="text-xs text-muted-foreground">
                    {update.timestamp}
                  </p>
                </div>
                <button
                  className="ask-button ask-button--quiet"
                  aria-label={`Helpful update, ${update.upvotes} votes`}
                  disabled={!onUpvote}
                  onClick={() => onUpvote?.(update.id)}
                >
                  <ThumbsUp aria-hidden="true" />
                  {formatAskNumber(update.upvotes)}
                </button>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {update.content}
              </p>
            </article>
          ))}
          {!expanded && thread.updates.length > 2 && (
            <button
              className="ask-button ask-button--secondary"
              onClick={() => setExpanded(true)}
            >
              Show all updates
            </button>
          )}
        </div>
      )}
      {thread.canContinue && (
        <div className="ask-note mt-4">
          <button
            className="ask-button ask-button--primary w-full"
            onClick={onContinueThread}
            disabled={!onContinueThread}
          >
            <Plus aria-hidden="true" />
            Continue your story
          </button>
          <p className="text-xs mt-2">Share an update with the community.</p>
        </div>
      )}
    </section>
  );
}
export default AnonymousThreadComponent;
