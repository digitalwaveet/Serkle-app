import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, Eye, Lock, StopCircle } from "lucide-react";
import {
  chatRpc,
  usePollData,
  useVoterInsights,
} from "@/hooks/useGroupManagement";
import { chatPollCounts } from "@/lib/chatPoll";
import { messageCount } from "@/lib/messagingPresentation";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
interface Props {
  pollId: string;
  isOwn: boolean;
  currentUserId: string;
}
export default function PollMessageBubble({ pollId, currentUserId }: Props) {
  const client = useQueryClient(),
    pollQuery = usePollData(pollId),
    poll = pollQuery.data;
  const [showInsights, setShowInsights] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const creator = poll?.creator_id === currentUserId,
    ended = poll?.status === "ended",
    anonymous = !!poll?.is_anonymous;
  const insights = useVoterInsights(
    pollId,
    showInsights && creator && !anonymous,
  );
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["poll-data", pollId] }),
      client.invalidateQueries({ queryKey: ["group-polls"] }),
    ]);
  const vote = useMutation({
    mutationFn: ({
      optionId,
      selected,
    }: {
      optionId: string;
      selected: boolean;
    }) =>
      chatRpc("set_chat_poll_vote", {
        p_poll_id: pollId,
        p_option_id: optionId,
        p_selected: selected,
      }),
    onSuccess: refresh,
  });
  const end = useMutation({
    mutationFn: () => chatRpc("end_chat_group_poll", { p_poll_id: pollId }),
    onSuccess: refresh,
  });
  const run = async (callback: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setError("");
    try {
      await callback();
    } catch {
      setError("This poll could not be updated. Please try again.");
    } finally {
      lock.current = false;
    }
  };
  if (pollQuery.isLoading)
    return <SerkleLoader size="sm" label="Loading poll" />;
  if (pollQuery.error || !poll)
    return (
      <div className="msg-error" role="alert">
        This poll couldn’t be loaded.
        <button
          className="msg-button quiet"
          onClick={() => void pollQuery.refetch()}
        >
          Retry poll
        </button>
      </div>
    );
  const stats = chatPollCounts(poll, currentUserId),
    options = Array.isArray(poll.options) ? poll.options : [],
    busy = vote.isPending || end.isPending;
  return (
    <section className="msg-poll" aria-label="Group poll">
      <div className="flex items-start gap-2 mb-2">
        <BarChart3 className="size-4 shrink-0 mt-1" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{poll.question}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {ended
          ? "Poll ended"
          : poll.is_multiple_choice
            ? "Choose any options"
            : "Choose one option"}
        {anonymous && (
          <span className="inline-flex items-center gap-1 ml-2">
            <Lock className="size-3" aria-hidden="true" />
            Anonymous
          </span>
        )}
      </p>
      <div className="space-y-2">
        {options.map((option: any) => {
          const selected = stats.selected.includes(option.id),
            showResults = ended || stats.selected.length > 0;
          return (
            <button
              key={option.id}
              className={`msg-poll-option ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              disabled={ended || busy}
              onClick={() =>
                void run(() =>
                  vote.mutateAsync({
                    optionId: option.id,
                    selected: !selected,
                  }),
                )
              }
            >
              <span
                className="msg-poll-fill"
                style={{
                  width: showResults ? `${stats.percentage(option.id)}%` : "0%",
                }}
              />
              <span>
                {selected && (
                  <Check className="inline size-3 mr-1" aria-hidden="true" />
                )}
                {option.text}
              </span>
              {showResults && stats.known && (
                <span>{stats.percentage(option.id)}%</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-xs text-muted-foreground">
          {stats.known
            ? messageCount(stats.total, "vote")
            : "Vote count unavailable"}
        </span>
        {creator && !ended && (
          <button
            className="msg-button quiet"
            disabled={busy}
            onClick={() => void run(() => end.mutateAsync())}
          >
            <StopCircle aria-hidden="true" />
            End poll
          </button>
        )}
        {creator && !anonymous && (
          <button
            className="msg-icon"
            aria-label={showInsights ? "Hide voters" : "View voters"}
            aria-expanded={showInsights}
            onClick={() => setShowInsights((value) => !value)}
          >
            <Eye aria-hidden="true" />
          </button>
        )}
      </div>
      {error && (
        <p className="msg-error" role="alert">
          {error}
        </p>
      )}
      {creator && !anonymous && showInsights && (
        <div className="border-t border-border pt-3 mt-2">
          <h4 className="text-xs font-semibold mb-2">Voter details</h4>
          {insights.isLoading ? (
            <SerkleLoader size="xs" label="Loading voters" />
          ) : insights.error ? (
            <p className="msg-error" role="alert">
              Voters couldn’t be loaded.
              <button
                className="msg-button quiet"
                onClick={() => void insights.refetch()}
              >
                Retry voters
              </button>
            </p>
          ) : (
            (insights.data || []).map((entry: any, index: number) => (
              <p
                className="text-xs text-muted-foreground"
                key={`${entry.user_id}-${entry.option_id}-${index}`}
              >
                {entry.profile?.name || "Member"} ·{" "}
                {
                  options.find((option: any) => option.id === entry.option_id)
                    ?.text
                }
              </p>
            ))
          )}
        </div>
      )}
    </section>
  );
}
