import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, MessageCircle, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./AskDialog";
import { useExpertProfiles } from "@/hooks/useExpertProfiles";
import { ExpertProfileModal } from "./ExpertProfileModal";
import { AskLoading, AskState } from "./AskState";
import { formatAskCount, formatAskNumber } from "@/lib/askPresentation";
export function AllExpertsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { data: experts, isLoading, error, refetch } = useExpertProfiles(50);
  const [selected, setSelected] = useState<any>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verified community experts</DialogTitle>
          <DialogDescription>
            Explore professional profiles and their community replies.
          </DialogDescription>
        </DialogHeader>
        <div className="ask-dialog-body">
          {isLoading ? (
            <AskLoading label="Loading experts" />
          ) : error ? (
            <AskState
              title="Experts couldn’t be loaded"
              description="Try loading this directory again."
              onRetry={() => void refetch()}
            />
          ) : !experts?.length ? (
            <AskState
              title="No verified experts yet"
              description="Verified community experts will appear here."
            />
          ) : (
            <ul className="space-y-4">
              {experts.map((expert: any) => (
                <li key={expert.id} className="ask-question-card">
                  <button
                    className="ask-author w-full text-left"
                    aria-label={`View ${expert.profiles?.name || "expert"}’s profile`}
                    onClick={() => setSelected(expert)}
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
                  <div className="ask-signals">
                    <span className="ask-signal">
                      <BadgeCheck aria-hidden="true" />
                      Verified expert
                    </span>
                  </div>
                  {expert.bio && (
                    <p className="text-sm text-muted-foreground my-3 line-clamp-3">
                      {expert.bio}
                    </p>
                  )}
                  <div className="ask-counts mt-4">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-4" aria-hidden="true" />
                      {typeof expert.answers_count === "number"
                        ? formatAskCount(expert.answers_count, "answer")
                        : "Replies unavailable"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-4" aria-hidden="true" />
                      {typeof expert.followers_count === "number"
                        ? formatAskCount(expert.followers_count, "follower")
                        : "Followers unavailable"}
                    </span>
                  </div>
                  {expert.featured_answer?.question_id && (
                    <button
                      className="ask-button ask-button--secondary w-full mt-4"
                      onClick={() => {
                        onClose();
                        navigate(
                          `/ask/question/${expert.featured_answer.question_id}`,
                        );
                      }}
                    >
                      View featured answer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected && (
          <ExpertProfileModal
            open={!!selected}
            onClose={() => setSelected(null)}
            expert={selected}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
