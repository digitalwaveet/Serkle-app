import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageCircle,
  ThumbsUp,
  BadgeCheck,
  Glasses,
  Sparkles,
  GitBranch,
} from "lucide-react";
import { useQuestionVote, useUserVotes } from "@/hooks/useQuestions";
import { AnonymousAvatar } from "./AnonymousAvatar";
import { ExpertProfileModal } from "./ExpertProfileModal";
import {
  formatAskCount,
  formatAskNumber,
  askCategory,
  isAskSummaryReady,
} from "@/lib/askPresentation";
interface Question {
  [key: string]: any;
  id: string;
  question: string;
  category: string;
  timestamp: string;
  answerCount?: number;
  expertAnswerCount?: number;
  helpfulCount?: number;
  upvotes?: number;
  isThread?: boolean;
  threadUpdates?: number;
  discussionSummary?: unknown;
  is_anonymous?: boolean;
  anonymous_name?: string;
  isExpert?: boolean;
  expertUserId?: string;
  expertProfile?: any;
}
export function QuestionCard({
  question,
  onClick,
}: {
  question: Question;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  const vote = useQuestionVote();
  const { data: userVotes } = useUserVotes();
  const voted = !!userVotes?.questions?.includes(question.id);
  const [expert, setExpert] = useState<any>(null),
    [error, setError] = useState("");
  const lock = useRef(false);
  const open = () => {
    onClick?.();
    navigate(`/ask/question/${question.id}`);
  };
  const castVote = async () => {
    if (lock.current) return;
    lock.current = true;
    setError("");
    try {
      await vote.mutateAsync({ questionId: question.id, hasVoted: voted });
    } catch {
      setError("Your vote could not be saved. Please try again.");
    } finally {
      lock.current = false;
    }
  };
  const name =
    question.isExpert && question.expertProfile
      ? question.expertProfile.name || question.expertProfile.username
      : question.is_anonymous
        ? question.anonymous_name || "Anonymous"
        : question.profiles?.name || "Community member";
  const avatar =
    question.isExpert && question.expertProfile?.avatar_url ? (
      <img src={question.expertProfile.avatar_url} alt="" />
    ) : question.is_anonymous && question.anonymous_name ? (
      <AnonymousAvatar pseudonym={question.anonymous_name} size={36} />
    ) : (
      <Glasses className="size-5" aria-hidden="true" />
    );
  const helpful =
    question.helpfulCount ?? question.voteCount ?? question.upvotes;
  return (
    <>
      <article
        className="ask-question-card"
        data-testid={`ask-question-${question.id}`}
      >
        <div className="ask-author">
          <span className="ask-author-avatar">{avatar}</span>
          <div className="ask-author-copy">
            {question.isExpert && question.expertUserId ? (
              <button
                className="ask-author-name"
                onClick={() =>
                  setExpert({
                    user_id: question.expertUserId,
                    profiles: question.expertProfile,
                    specialty: question.category,
                  })
                }
              >
                {name}
              </button>
            ) : (
              <span className="ask-author-name">{name}</span>
            )}
            <p>
              {question.isExpert
                ? "Verified expert"
                : question.is_anonymous
                  ? "Anonymous"
                  : "Community member"}{" "}
              · {question.timestamp}
            </p>
          </div>
          {question.category && (
            <span className="ask-category">
              {askCategory(question.category)}
            </span>
          )}
        </div>
        <h2>
          <button className="ask-question-title" onClick={open}>
            {question.question}
          </button>
        </h2>
        <div className="ask-question-footer">
          <button onClick={open}>
            <MessageCircle aria-hidden="true" />
            {typeof question.answerCount === "number"
              ? formatAskCount(question.answerCount, "answer")
              : "View replies"}
          </button>
          <button
            aria-pressed={voted}
            disabled={vote.isPending}
            onClick={() => void castVote()}
          >
            <ThumbsUp
              aria-hidden="true"
              className={voted ? "fill-current" : ""}
            />
            Helpful {formatAskNumber(helpful)}
          </button>
        </div>
        {(isAskSummaryReady(question.discussionSummary) ||
          question.isThread ||
          (question.expertAnswerCount ?? 0) > 0) && (
          <div className="ask-signals">
            {(question.expertAnswerCount ?? 0) > 0 && (
              <span className="ask-signal">
                <BadgeCheck aria-hidden="true" />
                {formatAskCount(question.expertAnswerCount!, "expertAnswer")}
              </span>
            )}
            {isAskSummaryReady(question.discussionSummary) && (
              <span className="ask-signal">
                <Sparkles aria-hidden="true" />
                AI summary available
              </span>
            )}
            {question.isThread && (
              <span className="ask-signal">
                <GitBranch aria-hidden="true" />
                {typeof question.threadUpdates === "number" &&
                question.threadUpdates > 0
                  ? formatAskCount(question.threadUpdates, "update")
                  : "Story thread"}
              </span>
            )}
          </div>
        )}
        {error && (
          <p className="ask-error" role="alert">
            {error}
          </p>
        )}
      </article>
      <ExpertProfileModal
        open={!!expert}
        onClose={() => setExpert(null)}
        expert={expert}
      />
    </>
  );
}
