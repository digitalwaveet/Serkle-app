import { useSyncExternalStore, useMemo } from "react";
const scenario = localStorage.getItem("ask-scenario") || "";
const listeners = new Set<() => void>();
const time = (hours: number) =>
  new Date(Date.now() - hours * 3600000).toISOString();
const owner = scenario.includes("owner") ? "viewer" : "original-author";
const summary = {
  status: "ready",
  summary_overview: "The discussion shares several personal routines.",
  most_suggest: ["Start with a small, manageable routine."],
  different_perspectives: [
    "People make room for creative work in different ways.",
  ],
  expert_input: [],
  answer_count_at_summary: 2,
};
const profile = {
  id: "viewer",
  name: "Actual Account Name",
  username: "actual.account",
  initials: "AN",
  avatar_url: "/sample/owner.svg",
  avatar_color: "#713a20",
};
const professional = {
  id: "expert-record",
  user_id: "expert-1",
  is_verified: true,
  specialty: "Career",
  professional_title: "Creative work mentor",
  bio: "A sample expert profile for isolated interface checks.",
  years_experience: 6,
  qualification: "Sample qualification",
  institution: "Sample institution",
  answers_count: 1,
  helpful_percentage: 0,
  followers_count: 2,
  profiles: {
    id: "expert-1",
    name: "Hana Tesfaye",
    username: "hana",
    initials: "HT",
    avatar_url: "",
    avatar_color: "#713a20",
  },
  featured_answer: {
    id: "answer-expert",
    question_id: "q1",
    questions: { question: "How do you switch off after a busy workday?" },
    answer: "I try one small routine and review what works for me.",
  },
};
const questions: Array<{ id: string; [key: string]: any }> = [
  {
    id: "q1",
    question: "How do you switch off after a busy workday?",
    category: "career",
    tags: ["work-life-balance"],
    created_at: time(2),
    user_id: owner,
    is_anonymous: true,
    anonymous_name: "Quiet Cedar",
    is_thread: true,
    answerCount: 2,
    expertAnswerCount: 1,
    helpfulCount: 2,
    voteCount: 2,
    threadUpdatesCount: 2,
    isExpert: scenario === "legacy-anon-expert",
    expertProfile: {
      name: "Private expert author",
      username: "private-expert",
    },
    ai_discussion_summary:
      scenario === "summary-ready"
        ? summary
        : scenario === "summary-pending"
          ? { status: "generating" }
          : null,
  },
  {
    id: "q2",
    question: "Which small routines help you make time for creative work?",
    category: "lifestyle",
    tags: [],
    created_at: time(4),
    user_id: "expert-1",
    is_anonymous: false,
    is_thread: false,
    answerCount: 1,
    expertAnswerCount: 0,
    helpfulCount: 1,
    voteCount: 1,
    threadUpdatesCount: 0,
    isExpert: true,
    expertProfile: professional.profiles,
  },
  {
    id: "q3",
    question: "How do you stay close to friends when everyone is busy?",
    category: "relationships",
    tags: [],
    created_at: time(6),
    user_id: "viewer",
    is_anonymous: true,
    anonymous_name: "River Finch",
    is_thread: true,
    answerCount: 0,
    expertAnswerCount: 0,
    helpfulCount: 0,
    voteCount: 0,
    threadUpdatesCount: 0,
    isExpert: false,
  },
];
let snapshot = {
  questions,
  answers: [
    {
      id: "a1",
      question_id: "q1",
      user_id: "expert-1",
      answer: "For me, one small routine helped more than a big plan.",
      created_at: time(1),
      isExpert: true,
      expertProfile: { specialty: "Career" },
      profile: professional.profiles,
      is_helpful: false,
    },
    {
      id: "a2",
      question_id: "q1",
      user_id: "viewer",
      answer: "I make time for a short walk when I can.",
      created_at: time(0.5),
      isExpert: false,
      profile,
      is_helpful: false,
    },
  ],
  updates: [
    {
      id: "u1",
      question_id: "q1",
      user_id: owner,
      title: "A small first step",
      content: "I tried a new routine this week.",
      created_at: time(1.5),
      upvotes: 0,
    },
    {
      id: "u2",
      question_id: "q1",
      user_id: owner,
      title: "One week later",
      content: "I’m finding a little more space for myself.",
      created_at: time(1),
      upvotes: 0,
    },
  ],
  votes: [] as string[],
  saved: [] as string[],
  followed: false,
  pending: "",
};
const publish = (value: Partial<typeof snapshot>) => {
  snapshot = { ...snapshot, ...value };
  listeners.forEach((listener) => listener());
};
function useStore() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}
export const fixture = {
  calls: [] as Array<{ name: string; value?: any }>,
  queries: [] as Array<{ filter: string; search?: string; category?: string }>,
  user: {
    ...profile,
    email: "account@example.test",
    avatar: profile.avatar_url,
    isOnline: false,
  },
  get state() {
    return snapshot;
  },
};
(window as any).askFixture = fixture;
const reload = async () => {};
const query = (data: any, loading = false, error = false) => ({
  data,
  isLoading: loading,
  error: error ? new Error("Fixture unavailable") : null,
  refetch: reload,
});
function mutation(name: string, apply: (value: any) => void = () => {}) {
  return {
    get isPending() {
      return snapshot.pending === name;
    },
    mutateAsync: async (value: any) => {
      fixture.calls.push({ name, value });
      publish({ pending: name });
      await new Promise((resolve) =>
        setTimeout(resolve, scenario.endsWith(`pending-${name}`) ? 700 : 50),
      );
      if (scenario.endsWith(`${name}-error`)) {
        publish({ pending: "" });
        throw new Error("Fixture " + name + " failed");
      }
      apply(value);
      publish({ pending: "" });
      return { id: "created-" + name };
    },
    mutate(value: any, options: any = {}) {
      void this.mutateAsync(value).then(
        (data) => options.onSuccess?.(data),
        (error) => options.onError?.(error),
      );
    },
  };
}
const createQuestion = mutation("create-question", (value) =>
  publish({
    questions: [
      {
        ...questions[2],
        ...value,
        id: "created-question",
        question: value.question,
        is_anonymous: value.isAnonymous,
        anonymous_name: value.anonymousName,
        is_thread: value.isThread,
        category: value.category,
      },
      ...snapshot.questions,
    ],
  }),
);
const questionVote = mutation("question-vote", (value) =>
  publish({
    votes: value.hasVoted
      ? snapshot.votes.filter((id) => id !== value.questionId)
      : [...snapshot.votes, value.questionId],
  }),
);
const answerVote = mutation("answer-vote");
const createAnswer = mutation("create-answer", (value) =>
  publish({
    answers: [
      ...snapshot.answers,
      {
        id: "answer-new",
        question_id: value.questionId,
        user_id: "viewer",
        answer: value.answer,
        created_at: time(0),
        isExpert: false,
        profile,
        is_helpful: false,
      },
    ],
  }),
);
const updateQuestion = mutation("update-question", (value) =>
  publish({
    questions: snapshot.questions.map((q) =>
      q.id === value.questionId ? { ...q, question: value.question } : q,
    ),
  }),
);
const deleteQuestion = mutation("delete-question", (id) =>
  publish({ questions: snapshot.questions.filter((q) => q.id !== id) }),
);
const updateAnswer = mutation("update-answer", (value) =>
  publish({
    answers: snapshot.answers.map((a) =>
      a.id === value.answerId ? { ...a, answer: value.answer } : a,
    ),
  }),
);
const deleteAnswer = mutation("delete-answer", (value) =>
  publish({ answers: snapshot.answers.filter((a) => a.id !== value.answerId) }),
);
const createUpdate = mutation("create-update", (value) =>
  publish({
    updates: [
      ...snapshot.updates,
      {
        id: "u3",
        question_id: value.questionId,
        user_id: "viewer",
        content: value.content,
        title: value.title,
        created_at: time(0),
        upvotes: 0,
      },
    ],
  }),
);
const updateUpdate = mutation("update-update", (value) =>
  publish({
    updates: snapshot.updates.map((u) =>
      u.id === value.updateId ? { ...u, content: value.content } : u,
    ),
  }),
);
const deleteUpdate = mutation("delete-update", (value) =>
  publish({ updates: snapshot.updates.filter((u) => u.id !== value.updateId) }),
);
const toggleBookmark = mutation("bookmark", (value) =>
  publish({
    saved: value.isBookmarked
      ? snapshot.saved.filter((id) => id !== value.questionId)
      : [...snapshot.saved, value.questionId],
  }),
);
const toggleFollow = mutation("follow", (value) =>
  publish({ followed: !value.isFollowed }),
);
const generate = mutation("generate-summary", (value) =>
  publish({
    questions: snapshot.questions.map((q) =>
      q.id === value.questionId ? { ...q, ai_discussion_summary: summary } : q,
    ),
  }),
);
export function useQuestions(
  filter: string,
  page: number,
  size: number,
  search = "",
  category = "all",
) {
  const state = useStore();
  const key = { filter, search, category };
  if (JSON.stringify(fixture.queries.at(-1)) !== JSON.stringify(key))
    fixture.queries.push(key);
  let data = state.questions.filter(
    (q) =>
      (category === "all" || q.category === category) &&
      (!search ||
        (q.question + " " + q.tags.join(" "))
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter !== "unanswered" || q.answerCount === 0) &&
      (filter !== "expert" || q.isExpert),
  );
  if (scenario === "empty" || scenario === "feed-empty-error") data = [];
  return query(
    data,
    scenario === "loading",
    scenario === "feed-error" || scenario === "feed-empty-error",
  );
}
export function useQuestion(id: string) {
  const state = useStore();
  return query(
    state.questions.find((q) => q.id === id),
    scenario === "detail-loading",
    scenario === "detail-error",
  );
}
export function useAnswers(id: string) {
  const state = useStore();
  const answers = useMemo(
    () => state.answers.filter((a) => a.question_id === id),
    [state.answers, id],
  );
  return query(
    answers,
    scenario === "answers-loading",
    scenario === "answers-error",
  );
}
export function useThreadUpdates(id: string) {
  const state = useStore();
  const updates = useMemo(
    () => state.updates.filter((u) => u.question_id === id),
    [state.updates, id],
  );
  return query(updates);
}
export function useUserVotes() {
  const state = useStore();
  return query({ questions: state.votes, answers: [] });
}
export function useCreateQuestion() {
  useStore();
  return createQuestion;
}
export function useQuestionVote() {
  useStore();
  return questionVote;
}
export function useAnswerVote() {
  useStore();
  return answerVote;
}
export function useCreateAnswer() {
  useStore();
  return createAnswer;
}
export function useUpdateQuestion() {
  useStore();
  return updateQuestion;
}
export function useDeleteQuestion() {
  useStore();
  return deleteQuestion;
}
export function useUpdateAnswer() {
  useStore();
  return updateAnswer;
}
export function useDeleteAnswer() {
  useStore();
  return deleteAnswer;
}
export function useCreateThreadUpdate() {
  useStore();
  return createUpdate;
}
export function useUpdateThreadUpdate() {
  useStore();
  return updateUpdate;
}
export function useDeleteThreadUpdate() {
  useStore();
  return deleteUpdate;
}
export function useGenerateDiscussionSummary() {
  useStore();
  return generate;
}
export function useIsQuestionBookmarked(id: string) {
  const state = useStore();
  return query(state.saved.includes(id));
}
export function useToggleQuestionBookmark() {
  useStore();
  return toggleBookmark;
}
export function useIsStoryFollowed() {
  const state = useStore();
  return query(state.followed);
}
export function useToggleStoryFollow() {
  useStore();
  return toggleFollow;
}
export const useStoryFollowersCount = () => query(2);
export const useExpertProfiles = () =>
  query(
    scenario === "no-experts" ? [] : [professional],
    scenario === "experts-loading",
    scenario === "experts-error",
  );
export const useIsExpert = () =>
  query(
    scenario === "identity-loading" ? undefined : scenario === "expert",
    scenario === "identity-loading",
    scenario === "identity-error",
  );
export function useExpertAnswers() {
  useStore();
  return query([
    {
      id: "a1",
      question_id: "q1",
      answer: "For me, one small routine helped more than a big plan.",
      created_at: time(1),
      question_text: questions[0].question,
      is_helpful: false,
    },
  ]);
}
export function useUserQuestions() {
  const state = useStore();
  return query(
    state.questions
      .filter((q) => q.user_id === "viewer")
      .map((q) => ({ ...q, upvotes: q.voteCount })),
    scenario === "activity-loading",
    scenario === "activity-error",
  );
}
export function useUserAnswers() {
  const state = useStore();
  return query(
    state.answers
      .filter((a) => a.user_id === "viewer")
      .map((a) => ({
        ...a,
        questions: state.questions.find((q) => q.id === a.question_id),
        upvotes: 0,
      })),
    scenario === "activity-loading",
    scenario === "activity-error",
  );
}
export function useQuestionBookmarks() {
  const state = useStore();
  return query(
    state.questions
      .filter((q) => state.saved.includes(q.id))
      .map((q) => ({ id: "saved-" + q.id, questions: q, created_at: time(1) })),
    scenario === "activity-loading",
    scenario === "activity-error",
  );
}
export const useAskStatistics = () =>
  query(
    { questionsAsked: 1, answersGiven: 1, helpfulAnswers: 0, totalUpvotes: 0 },
    scenario === "activity-loading",
    scenario === "statistics-error",
  );
export const useUser = () => ({ user: fixture.user, isLoading: false });
export const usePresence = () => ({
  isUserOnline: () => scenario === "online",
  getLastSeenText: () =>
    scenario === "historical" ? "Last seen 18 days ago" : null,
});
export const useUserPosts = () => ({ posts: [], isLoading: false });
export const useCreateConversation = () => ({
  createConversation: async (...value: any[]) => {
    fixture.calls.push({ name: "conversation", value });
  },
});
export const useConversations = () => ({});
export const useUnreadCount = () => ({ totalUnreadCount: 0 });
export const useFriendsList = () => query([]);
class Builder {
  table: string;
  verb = "select";
  value: any;
  filters: Record<string, any> = {};
  constructor(table: string) {
    this.table = table;
  }
  select(..._args: any[]) {
    return this;
  }
  eq(key: string, value: any) {
    this.filters[key] = value;
    return this;
  }
  in(..._args: any[]) {
    return this;
  }
  is(..._args: any[]) {
    return this;
  }
  or(..._args: any[]) {
    return this;
  }
  ilike(..._args: any[]) {
    return this;
  }
  order(..._args: any[]) {
    return this;
  }
  limit(..._args: any[]) {
    return this;
  }
  update(value: any) {
    this.verb = "update";
    this.value = value;
    return this;
  }
  insert(value: any) {
    this.verb = "insert";
    this.value = value;
    return this;
  }
  async single() {
    if (this.table === "profiles") return { data: profile, error: null };
    return { data: null, error: null };
  }
  async maybeSingle() {
    if (this.table !== "expert_profiles") return { data: null, error: null };
    return {
      data: {
        is_verified:
          this.filters.user_id === "expert-1" || scenario === "expert",
      },
      error: null,
    };
  }
  then(resolve: any, reject: any) {
    let data: any = [];
    let error: any = null;
    if (this.table === "question_votes") data = [{ id: "v1" }, { id: "v2" }];
    if (this.table === "answer_votes") data = [{ id: "v1", answer_id: "a1" }];
    if (this.table === "answers" && this.verb === "update") {
      fixture.calls.push({ name: "mark-helpful", value: this.filters.id });
      if (scenario === "helpful-error")
        error = new Error("Helpfulness unavailable");
      else
        publish({
          answers: snapshot.answers.map((a) =>
            a.id === this.filters.id ? { ...a, is_helpful: true } : a,
          ),
        });
    }
    return Promise.resolve({ data, error }).then(resolve, reject);
  }
}
export const supabase = {
  auth: {
    getUser: async () => ({
      data: { user: scenario === "auth-error" ? null : fixture.user },
      error: scenario === "auth-error" ? new Error("Auth unavailable") : null,
    }),
  },
  from: (table: string) => new Builder(table),
  channel: () => {
    const channel = {
      on() {
        return channel;
      },
      subscribe() {
        return channel;
      },
    };
    return channel;
  },
  removeChannel: async () => {},
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({
        data: { publicUrl: "https://example.test/update.jpg" },
      }),
    }),
  },
};
