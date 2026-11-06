import { SerkleLoader } from "@/components/ui/SerkleLoader";
import React, { useState } from "react";
import {
  Sparkles,
  BadgeCheck,
  MessageCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGenerateDiscussionSummary } from "@/hooks/useQuestions";
import { useToast } from "@/hooks/use-toast";
import { isAskSummaryReady } from "@/lib/askPresentation";

interface DiscussionSummaryData {
  status?: string;
  summary_overview?: string;
  most_suggest?: string[];
  different_perspectives?: string[];
  expert_input?: string[] | null;
  answer_count_at_summary?: number;
  generated_at?: string;
  message?: string;
}

interface AIDiscussionSummaryProps {
  questionId: string;
  questionText: string;
  category?: string;
  discussionSummary?: DiscussionSummaryData | null;
  answersCount: number;
  answers?: Array<{
    id: string;
    answer: string;
    isExpert?: boolean;
    isHelpful?: boolean;
    authorName?: string;
  }>;
}

export const AIDiscussionSummary: React.FC<AIDiscussionSummaryProps> = ({
  questionId,
  questionText,
  category,
  discussionSummary,
  answersCount,
  answers = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const summaryLock = React.useRef(false);
  const generateSummaryMutation = useGenerateDiscussionSummary();
  const { toast } = useToast();

  const handleGenerateSummary = async () => {
    if (summaryLock.current) return;
    if (answersCount < 2) {
      toast({
        title: "More answers needed",
        description:
          "AI discussion summaries require at least 2 community answers.",
      });
      return;
    }

    summaryLock.current = true;
    setSummaryError("");
    try {
      await generateSummaryMutation.mutateAsync({
        questionId,
        question: questionText,
        category,
        answers: answers.map((a) => ({
          id: a.id,
          answer: a.answer,
          isExpert: a.isExpert,
          isHelpful: a.isHelpful,
          authorName: a.authorName,
        })),
      });
      toast({
        title: "Discussion summary updated",
        description: "Synthesized latest community and expert input.",
      });
      setIsExpanded(true);
    } catch (error: any) {
      setSummaryError(
        "The summary could not be generated. You can still read all community replies.",
      );
      console.error("Error generating discussion summary:", error);
      toast({
        title: "Summary unavailable",
        description: error.message || "Failed to generate discussion summary.",
        variant: "destructive",
      });
    } finally {
      summaryLock.current = false;
    }
  };

  const hasSummary = isAskSummaryReady(discussionSummary);
  const hasInsufficient =
    answersCount < 2 || discussionSummary?.status === "insufficient_discussion";

  return (
    <div className="ask-ui ask-ai-summary space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="p-1 rounded-md bg-primary/10 text-primary">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span>AI Discussion Summary</span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-normal text-muted-foreground border-border bg-background/50"
          >
            {hasSummary ? "Generated from replies" : "AI-generated, on request"}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {answersCount >= 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateSummary}
              disabled={generateSummaryMutation.isPending}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary gap-1"
              title="Refresh discussion summary with latest answers"
              aria-label={
                hasSummary ? "Refresh AI summary" : "Generate AI summary"
              }
            >
              {generateSummaryMutation.isPending ? (
                <SerkleLoader
                  size="xs"
                  className="mr-1 text-current"
                  label="Refreshing"
                />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              <span className="text-xs">
                {hasSummary ? "Refresh" : "Summarize"}
              </span>
            </Button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            aria-label="Toggle discussion summary"
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {summaryError && (
        <p className="ask-error" role="alert">
          {summaryError}
        </p>
      )}
      {isExpanded && (
        <div className="space-y-3 pt-1 text-xs sm:text-sm">
          {/* Insufficient answers state */}
          {hasInsufficient && !hasSummary && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-background/60 border border-border/50 text-muted-foreground">
              <MessageCircle className="w-4 h-4 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-medium text-foreground text-xs">
                  Not enough discussion to summarize yet
                </p>
                <p className="text-[12px] leading-relaxed">
                  A summary needs at least two community replies. It is
                  generated from the discussion and may miss context; read the
                  original replies.
                </p>
              </div>
            </div>
          )}

          {/* Structured Discussion Summary */}
          {hasSummary && (
            <div className="space-y-3.5">
              {/* Neutral overview */}
              {discussionSummary.summary_overview && (
                <p className="text-muted-foreground leading-relaxed italic bg-background/50 p-2.5 rounded-lg border border-border/40 text-xs">
                  “{discussionSummary.summary_overview}”
                </p>
              )}

              {/* Section 1: Most answers suggest */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                  Most answers suggest:
                </h4>
                {discussionSummary.most_suggest &&
                discussionSummary.most_suggest.length > 0 ? (
                  <ul className="space-y-1 pl-4 list-disc text-foreground/90 leading-relaxed text-xs sm:text-[13px]">
                    {discussionSummary.most_suggest.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground pl-4">
                    No single dominant suggestion identified.
                  </p>
                )}
              </div>

              {/* Section 2: Different perspectives */}
              {discussionSummary.different_perspectives &&
                discussionSummary.different_perspectives.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-border/40">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                      Different perspectives:
                    </h4>
                    <ul className="space-y-1 pl-4 list-disc text-foreground/90 leading-relaxed text-xs sm:text-[13px]">
                      {discussionSummary.different_perspectives.map(
                        (item, idx) => (
                          <li key={idx}>{item}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              {/* Section 3: Verified professional input */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                  Verified professional input:
                </h4>
                {discussionSummary.expert_input &&
                discussionSummary.expert_input.length > 0 ? (
                  <div className="pl-3 border-l-2 border-primary/40 space-y-1 py-0.5">
                    {discussionSummary.expert_input.map((item, idx) => (
                      <p
                        key={idx}
                        className="text-xs sm:text-[13px] text-foreground font-medium leading-relaxed"
                      >
                        • {item}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pl-4 italic">
                    No verified professional input is included in this summary.
                  </p>
                )}
              </div>

              {/* Footer attribution */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground/80">
                <span>
                  Generated from{" "}
                  {discussionSummary.answer_count_at_summary ?? answersCount}{" "}
                  community answers
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default AIDiscussionSummary;
