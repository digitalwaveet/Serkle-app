import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Award,
  MessageCircle,
  ThumbsUp,
  Bookmark,
} from "lucide-react";
import Header from "@/components/Header";
import { useUser } from "@/contexts/UserContext";
import {
  useUserQuestions,
  useUserAnswers,
  useAskStatistics,
} from "@/hooks/useAskHistory";
import { useQuestionBookmarks } from "@/hooks/useQuestionBookmarks";
import { useIsExpert } from "@/hooks/useExpertProfiles";
import { AnonymousAvatar } from "@/components/ask/AnonymousAvatar";
import { AskLoading, AskState } from "@/components/ask/AskState";
import ExpertVerificationModal from "@/components/ExpertVerificationModal";
import {
  askCategory,
  askTime,
  formatAskCount,
  formatAskNumber,
} from "@/lib/askPresentation";
import "@/components/ask/ask.css";
export default function AskProfile() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useUser();
  const [tab, setTab] = useState<"questions" | "answers" | "saved">(
      "questions",
    ),
    [verify, setVerify] = useState(false);
  const questions = useUserQuestions(user?.id),
    answers = useUserAnswers(user?.id),
    statistics = useAskStatistics(user?.id),
    saved = useQuestionBookmarks(user?.id),
    expert = useIsExpert(user?.id);
  const active =
    tab === "questions" ? questions : tab === "answers" ? answers : saved;
  const rows = (active.data || []) as any[];
  return (
    <div className="ask-root">
      <Header />
      <section className="ask-ui ask-shell">
        <main className="ask-main">
          <button
            className="ask-button ask-button--quiet mb-5"
            onClick={() => navigate("/ask")}
          >
            <ArrowLeft aria-hidden="true" />
            Back to Ask
          </button>
          <div className="ask-profile-header">
            <div>
              <p className="ask-eyebrow">Your space</p>
              <h1>My Ask activity</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Your questions, replies and saved conversations.
              </p>
            </div>
          </div>
          {userLoading ? (
            <AskLoading label="Loading your activity" />
          ) : !user ? (
            <AskState
              title="Sign in to see your activity"
              description="Your questions and saved conversations are linked to your account."
              onRetry={() => navigate("/login")}
              retryLabel="Sign in"
            />
          ) : (
            <>
              <section
                className="ask-profile-summary"
                aria-label="Your Ask profile"
              >
                <div className="ask-author">
                  <span className="ask-author-avatar">
                    {user.avatar ? (
                      <img src={user.avatar} alt="" />
                    ) : (
                      <span>{user.initials}</span>
                    )}
                  </span>
                  <div className="ask-author-copy">
                    <span className="ask-author-name">{user.name}</span>
                    <p>@{user.username}</p>
                  </div>
                </div>
                {expert.isLoading ? (
                  <p className="text-xs text-muted-foreground mt-4">
                    Checking expert status…
                  </p>
                ) : expert.error ? (
                  <div className="ask-error" role="alert">
                    Expert status is unavailable.
                    <button
                      className="ask-button ask-button--quiet"
                      onClick={() => void expert.refetch()}
                    >
                      Retry status
                    </button>
                  </div>
                ) : expert.data ? (
                  <div className="ask-note mt-4">
                    <span className="inline-flex items-center gap-2 text-primary">
                      <BadgeCheck className="size-4" aria-hidden="true" />
                      Verified expert
                    </span>
                    <p className="text-xs mt-1">
                      Your expert posts use your public profile.
                    </p>
                  </div>
                ) : (
                  <button
                    className="ask-button ask-button--secondary w-full mt-4"
                    onClick={() => setVerify(true)}
                  >
                    <Award aria-hidden="true" />
                    Apply for expert verification
                  </button>
                )}
                <div className="ask-profile-stats">
                  {[
                    {
                      label: "Questions",
                      value: statistics.data?.questionsAsked,
                    },
                    { label: "Answers", value: statistics.data?.answersGiven },
                    {
                      label: "Helpful",
                      value: statistics.data?.helpfulAnswers,
                    },
                    { label: "Upvotes", value: statistics.data?.totalUpvotes },
                  ].map((stat) => (
                    <div className="ask-profile-stat" key={stat.label}>
                      <strong>
                        {statistics.isLoading || statistics.error
                          ? "—"
                          : formatAskNumber(stat.value)}
                      </strong>
                      {stat.label}
                    </div>
                  ))}
                </div>
                {statistics.error && (
                  <p className="ask-error" role="alert">
                    Your statistics could not be loaded.
                    <button
                      className="ask-button ask-button--quiet"
                      onClick={() => void statistics.refetch()}
                    >
                      Retry statistics
                    </button>
                  </p>
                )}
              </section>
              <div
                className="ask-sort mb-5"
                role="group"
                aria-label="Activity type"
              >
                {(["questions", "answers", "saved"] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                  >
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
              {active.isLoading ? (
                <AskLoading label={`Loading your ${tab}`} />
              ) : active.error ? (
                <AskState
                  title="Your activity couldn’t be loaded"
                  description="Try loading this part of your activity again."
                  onRetry={() => void active.refetch()}
                />
              ) : !rows.length ? (
                <AskState
                  title={
                    tab === "questions"
                      ? "No questions yet"
                      : tab === "answers"
                        ? "No answers yet"
                        : "No saved questions yet"
                  }
                  description={
                    tab === "saved"
                      ? "Save a question from its detail page to find it here."
                      : "Your contributions to Ask will appear here."
                  }
                />
              ) : (
                <div className="space-y-4">
                  {rows.map((row) => {
                    const question = tab === "questions" ? row : row.questions;
                    const id =
                      question?.id ||
                      (tab === "answers" ? row.question_id : undefined);
                    return (
                      <button
                        className="ask-activity-row"
                        key={row.id}
                        disabled={!id}
                        onClick={() => navigate(`/ask/question/${id}`)}
                      >
                        {tab === "questions" &&
                          row.is_anonymous &&
                          row.anonymous_name && (
                            <span className="ask-author mb-3">
                              <AnonymousAvatar
                                pseudonym={row.anonymous_name}
                                size={28}
                              />
                              <span className="text-xs text-muted-foreground">
                                {row.anonymous_name} · Anonymous
                              </span>
                            </span>
                          )}
                        <h3>{question?.question || "Question unavailable"}</h3>
                        {tab === "answers" && (
                          <p className="line-clamp-3">{row.answer}</p>
                        )}
                        <span className="ask-activity-meta">
                          {tab === "questions" && (
                            <>
                              <span className="inline-flex gap-1 items-center">
                                <MessageCircle aria-hidden="true" />
                                {formatAskCount(row.answerCount, "answer")}
                              </span>
                              <span className="inline-flex gap-1 items-center">
                                <ThumbsUp aria-hidden="true" />
                                {formatAskCount(row.upvotes, "upvote")}
                              </span>
                            </>
                          )}
                          {tab === "answers" && (
                            <span>
                              {formatAskCount(row.upvotes, "upvote")}
                              {row.is_helpful ? " · Marked helpful" : ""}
                            </span>
                          )}
                          {question?.category && (
                            <span>{askCategory(question.category)}</span>
                          )}
                          <span>
                            {tab === "saved" ? "Saved " : ""}
                            {askTime(row.created_at)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <ExpertVerificationModal
                open={verify}
                onClose={() => setVerify(false)}
                userId={user.id}
                appearance="ask"
              />
            </>
          )}
        </main>
      </section>
    </div>
  );
}
