import React from "react";
import { useQuestions } from "@/hooks/useQuestions";
import { QuestionCard } from "./QuestionCard";
import { AskLoading, AskState } from "./AskState";
import { askTime } from "@/lib/askPresentation";
interface Props {
  filter: "recent" | "trending" | "unanswered" | "expert";
  searchQuery?: string;
  categoryFilter?: string;
}
export function QuestionFeed({ filter, searchQuery, categoryFilter }: Props) {
  const {
    data: questions,
    isLoading,
    error,
    refetch,
  } = useQuestions(filter, 0, 20, searchQuery, categoryFilter);
  if (isLoading) return <AskLoading />;
  if (error && !questions?.length)
    return (
      <AskState
        title="Questions couldn’t be loaded"
        description="Your community’s questions are still there. Try loading them again."
        onRetry={() => void refetch()}
      />
    );
  if (!questions?.length)
    return (
      <AskState
        title={
          searchQuery
            ? "No matching questions"
            : filter === "unanswered"
              ? "No unanswered questions in this view"
              : "No questions here yet"
        }
        description={
          searchQuery
            ? "Try a different word or topic."
            : "New questions in this view will appear here."
        }
      />
    );
  return (
    <div className="ask-feed">
      {error && (
        <div className="ask-error" role="alert">
          Showing your last loaded questions. Updates are unavailable.{" "}
          <button
            className="ask-button ask-button--quiet"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      )}
      {questions.map((q: any) => (
        <QuestionCard
          key={q.id}
          question={{
            ...q,
            timestamp: askTime(q.created_at),
            answerCount: q.answerCount,
            expertAnswerCount: q.expertAnswerCount,
            helpfulCount: q.helpfulCount,
            upvotes: q.voteCount,
            isThread: q.is_thread,
            threadUpdates: q.threadUpdatesCount,
            discussionSummary: q.ai_discussion_summary,
            expertUserId: q.isExpert && !q.is_anonymous ? q.user_id : undefined,
            isExpert: q.isExpert && !q.is_anonymous,
            is_anonymous: q.is_anonymous,
          }}
        />
      ))}
    </div>
  );
}
