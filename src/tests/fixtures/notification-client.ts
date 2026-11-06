import { useSyncExternalStore } from "react";
const scenario = localStorage.getItem("notification-scenario") || "";
const listeners = new Set<() => void>();
const ago = (hours: number) =>
  new Date(Date.now() - hours * 3600000).toISOString();
const notification = (
  id: string,
  type: string,
  title: string,
  body: string,
  hours: number,
  data: Record<string, string> = {},
  read = false,
) => ({
  id,
  notification_type: type,
  title,
  body,
  sent_at: ago(hours),
  created_at: ago(hours),
  read_at: read ? ago(hours) : null,
  data,
});
const initial = [
  notification(
    "circle",
    "circle_event",
    "A new gathering in Creative Circle",
    "Your community has a new event. Take a look at the details.",
    0.08,
    { circleId: "creative" },
  ),
  notification(
    "like-a",
    "like",
    "Hana liked your post",
    "A little appreciation for your latest post.",
    0.2,
    { userId: "hana", postId: "sunrise" },
  ),
  notification(
    "like-b",
    "like",
    "Dawit liked your post",
    "A little appreciation for your latest post.",
    0.4,
    { userId: "dawit", postId: "sunrise" },
    true,
  ),
  notification(
    "message-a",
    "new_message",
    "Hana sent you a message",
    "Are you joining the gathering this weekend?",
    0.6,
    { senderId: "hana", conversationId: "chat-hana" },
  ),
  notification(
    "message-b",
    "new_message",
    "Hana sent you a message",
    "Let me know when you have a moment.",
    0.8,
    { senderId: "hana", conversationId: "chat-hana" },
    true,
  ),
  notification(
    "order",
    "order_shipped",
    "Your order is on its way",
    "Your handmade notebook has shipped. View tracking and order details.",
    25,
    { orderId: "notebook" },
    true,
  ),
  notification(
    "safety",
    "helper_request",
    "Someone nearby needs support",
    "Open Safe Mode to review this request.",
    26,
    {},
    true,
  ),
  notification(
    "follow",
    "follow",
    "Dawit started following you",
    "Say hello and explore their profile.",
    100,
    { userId: "dawit" },
    true,
  ),
];
if (scenario === "long")
  initial[0].title =
    "A very long community notification title with SupercalifragilisticexpialidociousWithoutAnySpacesAndMoreCharacters";
if (scenario === "many")
  for (let i = 0; i < 30; i++)
    initial.push(
      notification(
        "extra-" + i,
        "circle_post",
        "More from your community " + i,
        "Keep up with the conversation.",
        1 + i / 100,
        { circleId: "creative", postId: "extra-" + i },
        true,
      ),
    );
if (scenario === "mixed-batch") {
  initial.find((row) => row.id === "like-a")!.read_at = ago(0.1);
  initial.find((row) => row.id === "like-b")!.read_at = null;
}
if (scenario.startsWith("story") || scenario === "reshare-error")
  initial.unshift(
    notification(
      "story",
      "story_mention",
      "Hana mentioned you in a story",
      "Take a look at the moment they shared.",
      0.05,
      { story_id: "story-original", mentioner_id: "hana" },
    ),
  );
const profiles = [
  {
    id: "hana",
    name: "Hana Tesfaye",
    initials: "HT",
    avatar_url: "",
    avatar_color: "#713a20",
  },
  {
    id: "dawit",
    name: "Dawit Alemu",
    initials: "DA",
    avatar_url: "",
    avatar_color: "#713a20",
  },
];
let snapshot = {
  notifications:
    scenario === "empty" || scenario === "loading" || scenario === "load-error"
      ? []
      : initial,
  isLoading: scenario === "loading",
  error:
    scenario === "load-error" || scenario === "cached-error"
      ? new Error("Fixture load failed")
      : null,
  pending: false,
  prefPending: false,
  prefError:
    scenario === "preference-load-error"
      ? new Error("Preferences unavailable")
      : null,
  preferences: {
    user_id: "fixture-user",
    enabled: true,
    sound_enabled: true,
    in_app_toasts: true,
    social_likes: true,
    social_comments: true,
    social_follows: true,
    social_mentions: true,
    circles_posts: true,
    circles_events: true,
    shop_orders: true,
    shop_disputes: true,
    messages_direct: true,
    messages_groups: true,
    sos_alerts: true,
    helper_responses: true,
  },
};
const publish = (value: Partial<typeof snapshot>) => {
  snapshot = { ...snapshot, ...value };
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const fixture = {
  calls: [] as Array<{ name: string; value?: unknown }>,
  user: {
    id: "fixture-user",
    name: "Hana Tesfaye",
    username: "hana",
    initials: "HT",
    avatar: "",
    isOnline: false,
  },
  subscriptions: [] as Array<{ options: any; handler: (payload: any) => void }>,
  get state() {
    return snapshot;
  },
};
(window as any).notificationFixture = fixture;
const mutation = (
  name: string,
  action: (value: any) => Partial<typeof snapshot>,
  preference = false,
) => {
  const perform = (value: any) =>
    new Promise<void>((resolve, reject) => {
      fixture.calls.push({ name, value });
      publish(preference ? { prefPending: true } : { pending: true });
      setTimeout(
        () => {
          const fail = scenario === name + "-error";
          publish({
            ...(fail ? {} : action(value)),
            ...(preference ? { prefPending: false } : { pending: false }),
          });
          if (fail) reject(new Error("Fixture " + name + " failed"));
          else resolve();
        },
        scenario.startsWith("pending-") ? 800 : 80,
      );
    });
  return {
    get isPending() {
      return preference ? snapshot.prefPending : snapshot.pending;
    },
    mutateAsync: perform,
    mutate(value: any, options: any = {}) {
      void perform(value)
        .then(
          () => options.onSuccess?.(),
          (error) => options.onError?.(error),
        )
        .finally(() => options.onSettled?.());
    },
  };
};
const markAsRead = mutation("mark", (id) => ({
  notifications: snapshot.notifications.map((row) =>
    row.id === id ? { ...row, read_at: new Date().toISOString() } : row,
  ),
}));
const markAllAsRead = mutation("all", () => ({
  notifications: snapshot.notifications.map((row) => ({
    ...row,
    read_at: new Date().toISOString(),
  })),
}));
const deleteNotification = mutation("delete", (ids) => ({
  notifications: snapshot.notifications.filter(
    (row) => !(Array.isArray(ids) ? ids : [ids]).includes(row.id),
  ),
}));
const clearAllNotifications = mutation("clear", () => ({ notifications: [] }));
const updatePreferences = mutation(
  "preference",
  (value) => ({ preferences: { ...snapshot.preferences, ...value } }),
  true,
);
export function useNotifications() {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  return {
    ...state,
    isFetching: state.isLoading,
    unreadCount: state.notifications.filter((row) => !row.read_at).length,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    refetch: async () => {
      fixture.calls.push({ name: "refetch" });
      publish({ notifications: initial, error: null });
    },
  };
}
export function useNotificationPreferences() {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  return {
    preferences: state.preferences,
    isLoading: scenario === "preference-loading",
    error: state.prefError,
    refetch: async () => publish({ prefError: null }),
    updatePreferences,
  };
}
export const useUser = () => ({ user: fixture.user, isLoading: false });
export const useCoinWallet = () => ({
  balance: 1250,
  isWalletLoading: false,
  isWalletError: false,
});
export const useUnreadCount = () => ({ totalUnreadCount: 0 });
export const useConversations = () => ({});
export const cacheManager = { forceRefresh() {} };
export const supabase = {
  auth: {
    signOut: async () => ({ error: null }),
    getUser: async () => ({ data: { user: fixture.user }, error: null }),
  },
  channel: () => {
    const channel = {
      on(_type: string, options: any, handler: (payload: any) => void) {
        fixture.subscriptions.push({ options, handler });
        return channel;
      },
      subscribe() {
        return channel;
      },
    };
    return channel;
  },
  removeChannel: () => {},
  from: (table: string) => ({
    select: () => ({
      in: async () =>
        scenario === "profile-error"
          ? { data: null, error: new Error("Profiles unavailable") }
          : { data: profiles, error: null },
      eq: () => ({
        single: async () =>
          scenario === "story-error"
            ? { data: null, error: new Error("Story unavailable") }
            : {
                data: {
                  media_url: "https://example.test/story.jpg",
                  media_type: "image",
                },
                error: null,
              },
      }),
    }),
    insert: async (value: any) => {
      fixture.calls.push({ name: "reshare", value });
      await new Promise((resolve) =>
        setTimeout(resolve, scenario === "story-pending" ? 800 : 80),
      );
      return {
        error:
          scenario === "reshare-error" ? new Error("Reshare failed") : null,
      };
    },
  }),
};
