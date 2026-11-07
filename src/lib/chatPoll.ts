export function chatPollCounts(
  poll: {
    options?: unknown;
    option_vote_counts?: Record<string, number>;
    total_vote_count?: number;
    user_option_ids?: string[];
    poll_votes?: { user_id: string; option_id: string }[];
  },
  userId: string,
) {
  const known =
    typeof poll.total_vote_count === "number" || Array.isArray(poll.poll_votes);
  const counts =
    poll.option_vote_counts ||
    Object.fromEntries(
      (Array.isArray(poll.options) ? poll.options : []).map(
        (option: { id: string }) => [
          option.id,
          (poll.poll_votes || []).filter((vote) => vote.option_id === option.id)
            .length,
        ],
      ),
    );
  const total =
    typeof poll.total_vote_count === "number"
      ? poll.total_vote_count
      : Array.isArray(poll.poll_votes)
        ? poll.poll_votes.length
        : null;
  const selected =
    poll.user_option_ids ||
    (poll.poll_votes || [])
      .filter((vote) => vote.user_id === userId)
      .map((vote) => vote.option_id);
  return {
    known,
    counts,
    total,
    selected,
    percentage: (id: string) =>
      known && total ? Math.round(((counts[id] || 0) / total) * 100) : 0,
  };
}
