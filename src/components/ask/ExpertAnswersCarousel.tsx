import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, ArrowRight } from "lucide-react";
import { useExpertProfiles } from "@/hooks/useExpertProfiles";
import { AllExpertsModal } from "./AllExpertsModal";
import { ExpertProfileModal } from "./ExpertProfileModal";
import { AskLoading, AskState } from "./AskState";
export function ExpertAnswersCarousel({
  onViewAnswer,
}: {
  onViewAnswer?: (questionId: string) => void;
}) {
  const navigate = useNavigate();
  const { data: experts, isLoading, error, refetch } = useExpertProfiles();
  const [all, setAll] = useState(false),
    [selected, setSelected] = useState<any>(null);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Community expertise</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Get to know verified experts on Serkle.
          </p>
        </div>
        <button
          className="ask-button ask-button--quiet"
          onClick={() => setAll(true)}
        >
          View all
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
      {isLoading ? (
        <AskLoading label="Loading experts" />
      ) : error && !experts?.length ? (
        <AskState
          title="Experts are unavailable"
          description="Your questions and community replies are still available."
          onRetry={() => void refetch()}
        />
      ) : !experts?.length ? (
        <p className="text-sm text-muted-foreground">
          Verified community experts will appear here.
        </p>
      ) : (
        <ul className="ask-expert-carousel" aria-label="Verified experts">
          {experts.map((expert: any) => (
            <li className="ask-question-card" key={expert.id}>
              <button
                className="ask-author w-full text-left"
                onClick={() => setSelected(expert)}
                aria-label={`View ${expert.profiles?.name || "expert"}’s profile`}
              >
                <span className="ask-author-avatar">
                  {expert.profiles?.avatar_url ? (
                    <img src={expert.profiles.avatar_url} alt="" />
                  ) : (
                    <BadgeCheck className="size-5" aria-hidden="true" />
                  )}
                </span>
                <span className="ask-author-copy">
                  <span className="ask-author-name">
                    {expert.profiles?.name ||
                      expert.profiles?.username ||
                      "Community expert"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {expert.professional_title || expert.specialty}
                  </span>
                </span>
              </button>
              <span className="ask-signal mt-3">
                <BadgeCheck aria-hidden="true" />
                Verified expert
              </span>
              {expert.featured_answer?.question_id ? (
                <>
                  <h3 className="text-base font-medium leading-relaxed mt-4 mb-2 line-clamp-2">
                    {expert.featured_answer.questions?.question ||
                      "Featured community answer"}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {expert.featured_answer.answer}
                  </p>
                  <button
                    className="ask-button ask-button--secondary w-full mt-4"
                    onClick={() => {
                      const id = expert.featured_answer.question_id;
                      if (onViewAnswer) onViewAnswer(id);
                      else navigate(`/ask/question/${id}`);
                    }}
                  >
                    View answer
                  </button>
                </>
              ) : (
                expert.bio && (
                  <p className="text-sm text-muted-foreground mt-4 line-clamp-3">
                    {expert.bio}
                  </p>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      <AllExpertsModal open={all} onClose={() => setAll(false)} />
      {selected && (
        <ExpertProfileModal
          open={!!selected}
          onClose={() => setSelected(null)}
          expert={selected}
        />
      )}
    </div>
  );
}
