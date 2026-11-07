import { useCallback, useSyncExternalStore } from "react";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
const mediaClient = createClient(location.origin, "isolated-fixture", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: { headers: { Authorization: "Bearer fixture-owner" } },
});
const scenario = localStorage.getItem("messages-scenario") || "";
const me = "00000000-0000-4000-8000-000000000001",
  friend = "00000000-0000-4000-8000-000000000002";
const dm = "10000000-0000-4000-8000-000000000001",
  group = "10000000-0000-4000-8000-000000000002",
  other = "10000000-0000-4000-8000-000000000003";
const now = Date.now(),
  time = (minutes: number) => new Date(now - minutes * 60000).toISOString();
const user = {
  id: me,
  name: "Selam Bekele",
  username: "selam",
  initials: "SB",
  avatar: "",
  avatar_url: "",
};
const profile = {
  id: friend,
  name: "Hana Tesfaye",
  username: "hana",
  initials: "HT",
  avatar_url: "",
  avatar_color: "#713a20",
};
const conv = (id: string, name: string, isGroup = false, unread = 0) => ({
  conversation_id: id,
  other_user_id: friend,
  other_user_name: name,
  other_user_username: name.toLowerCase().split(" ")[0],
  other_user_initials: name
    .split(" ")
    .map((word) => word[0])
    .join(""),
  other_user_avatar: "",
  other_user_online: false,
  is_group: isGroup,
  group_name: isGroup ? name : null,
  group_avatar_url: null,
  member_count: isGroup ? 3 : 2,
  last_message: isGroup
    ? "Hana: See you at the next meetup."
    : "Thanks! That sounds like a good plan.",
  last_message_at: time(id === dm ? 1 : id === group ? 7 : 25),
  last_message_sender_id: me,
  unread_count: unread,
});
let conversations = scenario.includes("empty")
  ? []
  : [
      conv(dm, "Hana Tesfaye", false, 3),
      conv(group, "Creative Circle", true, 1),
      conv(other, "Dawit Abebe", false, 0),
    ];
const message = (
  id: string,
  content: string,
  own = false,
  type = "text",
  attachment = "",
) => ({
  id,
  content,
  conversation_id: dm,
  sender_id: own ? me : friend,
  created_at: time(10 - Number(id.match(/^m(\d+)$/)?.[1] || 0)),
  updated_at: time(10),
  message_type: type,
  attachment_url: attachment,
  reply_to_id: "",
  seq: Number(id.match(/^m(\d+)$/)?.[1] || 0),
  created_seq: Number(id.match(/^m(\d+)$/)?.[1] || 0),
  sync_status: "sent",
  sender: own ? user : profile,
});
let messages = [
  message("m1", "Hey Selam! Have you seen the plan for Saturday?"),
  message("m2", "Yes! I can bring my camera. Looking forward to it.", true),
  message(
    "m3",
    "A little inspiration for the weekend.",
    false,
    "photo",
    "/sample/shared.svg",
  ),
  message("m4", "Thanks! That sounds like a good plan.", true),
];
const shared = [
  ...messages,
  message(
    "file1",
    "Brand guidelines.pdf",
    false,
    "file",
    "chat-media://shared/file.pdf",
  ),
  message(
    "audio1",
    "Session audio",
    false,
    "audio",
    "chat-media://shared/audio.wav",
  ),
  message(
    "voice1",
    "🎤 Voice (12s)",
    false,
    "voice",
    "chat-media://shared/voice.wav",
  ),
  message("link1", "A helpful reference https://example.com/creative"),
];
const listeners = new Set<() => void>();
const storedMessages = new Map<string, any>();
let revision = 0;
const fixture = {
  deletions: [] as { message_id: string }[],
  deltas: null as any[] | null,
  calls: [] as { name: string; value: any }[],
  failures: {} as Record<string, number>,
  delay: 150,
  me,
  friend,
  dm,
  group,
  other,
  emit() {
    revision++;
    listeners.forEach((listener) => listener());
  },
  setUnread(count: number) {
    conversations[0].unread_count = count;
    this.emit();
  },
  setFailure(name: string, count = 1) {
    this.failures[name] = count;
  },
  messages: () => messages,
};
(window as any).messagesFixture = fixture;
function observe() {
  useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => revision,
  );
}
async function action(name: string, value: any) {
  fixture.calls.push({ name, value });
  await new Promise((resolve) => setTimeout(resolve, fixture.delay));
  if (fixture.failures[name] > 0) {
    fixture.failures[name]--;
    throw new Error("Sample request failed");
  }
  return value;
}
function mutation(name: string, callback?: (value: any) => any) {
  return useMutation({
    mutationFn: async (value: any) => {
      await action(name, value);
      const result = callback?.(value);
      fixture.emit();
      return result;
    },
  });
}
export const useUser = () => ({
  user: scenario === "guest" ? null : user,
  isLoading: false,
});
export function useConversations() {
  observe();
  return {
    conversations,
    isLoading: scenario === "loading",
    isSyncing: false,
    error: scenario === "sync-error" ? new Error("Sample offline") : null,
    refetch: () => action("refresh", null),
  };
}
export function useCreateConversation() {
  return {
    createConversation: useCallback(async (a: string, b: string) => {
      await action("create-dm", { a, b });
      return dm;
    }, []),
  };
}
const pinned = new Set<string>();
export function usePinnedConversations() {
  observe();
  return pinned;
}
export function useTogglePin() {
  return {
    togglePin: async (
      userId: string,
      conversationId: string,
      isPinned: boolean,
    ) => {
      await action("pin-conversation", { conversationId, isPinned });
      if (isPinned) pinned.add(conversationId);
      else pinned.delete(conversationId);
      fixture.emit();
    },
  };
}
export function useUnreadCount() {
  observe();
  return {
    isLoading: scenario === "count-loading",
    totalUnreadCount: conversations.reduce((sum, c) => sum + c.unread_count, 0),
    unreadConversationCount: conversations.filter((c) => c.unread_count > 0)
      .length,
    getUnreadCountForConversation: (id: string) =>
      conversations.find((c) => c.conversation_id === id)?.unread_count || 0,
  };
}
export function useMessages(id: string) {
  observe();
  return {
    messages:
      scenario === "chat-empty"
        ? []
        : messages.map((m) => ({ ...m, conversation_id: id })),
    isLoading: false,
    isSyncing: false,
    hasMore: false,
    loadMore: () => {},
    showMessage: async (messageId: string) => {
      await action("show-message", messageId);
    },
    error: scenario === "chat-error" ? new Error("Sample unavailable") : null,
    refetch: () => action("refresh-chat", id),
  };
}
export function useSendMessage() {
  const send = mutation("send", (value) => {
    const existing = messages.find((m) => m.id === value.id);
    if (!existing)
      messages = [
        ...messages,
        {
          ...message(
            value.id || crypto.randomUUID(),
            value.content,
            true,
            value.messageType || "text",
            value.attachmentUrl || "",
          ),
          seq: messages.length + 1,
          created_at: time(0),
        },
      ];
  });
  return { sendMessageAsync: send.mutateAsync, isSending: send.isPending };
}
export const useOtherUserLastRead = () => 2;
export const useRetryMessage = () => mutation("retry-message");
export function useMessageReactions() {
  return { reactions: [], toggleReaction: mutation("reaction") };
}
export const useEditMessage = () =>
  mutation("edit", (value) => {
    messages = messages.map((m) =>
      m.id === value.messageId
        ? { ...m, content: value.content, is_edited: true }
        : m,
    );
  });
export const useDeleteMessage = () => ({
  deleteForMe: mutation("delete-me", (value) => {
    messages = messages.filter((m) => m.id !== value.messageId);
  }),
  deleteForEveryone: mutation("delete-everyone", (value) => {
    messages = messages.filter((m) => m.id !== value.messageId);
  }),
});
export const useForwardMessage = () => mutation("forward");
export const usePinnedMessage = () => ({
  pinnedMessage: null,
  pinMessage: (id: string) => action("pin-message", id),
  unpinMessage: () => action("unpin-message", null),
});
export const usePresence = () => ({
  isUserOnline: () => scenario === "online",
  getLastSeenText: () =>
    scenario === "presence-unknown" ? "" : "Last active 18 days ago",
});
export const useGlobalTyping = () => ({
  getTypingText: () => "",
  isTyping: () => false,
});
export const useTypingIndicator = () => ({
  typingUsers: [],
  isOtherTyping: false,
  typingText: "",
  startTyping: () => {},
  stopTyping: () => {},
});
export const useFriendsList = () => ({
  data: [
    profile,
    { ...profile, id: other, name: "Dawit Abebe", username: "dawit" },
  ],
  isLoading: false,
  error: null,
  refetch: () => {},
});
export function useSharedChatHistory() {
  return {
    messages: shared,
    isLoading: false,
    error: scenario === "media-history-error" ? new Error("Unavailable") : null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => {},
    refetch: () => action("shared-retry", null),
  };
}
export function useChatMediaUrls() {
  return {
    url: (source: string) =>
      source?.startsWith("chat-media://") ? "" : source || "",
    failed: () => scenario === "media-failed",
    retry: () => action("media-retry", null),
  };
}
export const CHAT_MEDIA_TTL = 900;
export async function uploadChatMedia(conversationId: string, file: File) {
  await action("upload", { conversationId, name: file.name });
  return "chat-media://" + conversationId + "/" + file.name;
}
export const copyChatMediaToConversation = async () => "chat-media://copied";
export const resolveChatMedia = async () => "/sample/shared.svg";
export const syncConversations = async () => action("sync-conversations", null);
export const syncConversation = async () => action("sync-conversation", null);
export const processSyncQueue = async () => action("process-queue", null);
const members = [
  {
    ...user,
    is_creator: scenario !== "member" && scenario !== "admin",
    is_admin: scenario !== "member",
  },
  {
    ...profile,
    is_creator: scenario === "member" || scenario === "admin",
    is_admin: true,
  },
  {
    ...profile,
    id: other,
    name: "Dawit Abebe",
    username: "dawit",
    is_creator: false,
    is_admin: false,
  },
];
export function useGroupMembers() {
  observe();
  return {
    members,
    isLoading: false,
    error: scenario === "roles-error" ? new Error("Roles unavailable") : null,
    refetch: () => {},
    addMembers: mutation("add-members"),
    promoteToAdmin: mutation("promote"),
    demoteAdmin: mutation("demote"),
    removeMember: mutation("remove"),
    transferOwnership: mutation("transfer"),
    leaveGroup: mutation("leave", () => {
      conversations = conversations.filter((c) => c.conversation_id !== group);
    }),
  };
}
export function useGroupInfo() {
  return {
    groupInfo: {
      group_name: "Creative Circle",
      description:
        "A space to share ideas, make things, and keep creating together.",
      created_by: members.find((m) => m.is_creator)?.id,
    },
    isLoading: false,
    error: null,
    refetch: () => {},
    updateName: mutation("group-name"),
    updateDescription: mutation("group-description"),
    updateAvatar: mutation("group-avatar"),
  };
}
export function useGroupMute() {
  return {
    isMuted: false,
    isLoading: false,
    error: null,
    refetch: () => {},
    mute: mutation("mute"),
    unmute: mutation("unmute"),
  };
}
export function useGroupPolls() {
  return {
    polls: [],
    isLoading: false,
    error: null,
    refetch: () => {},
    createPoll: mutation("create-poll"),
    endPoll: mutation("end-poll"),
    vote: mutation("vote"),
    unvote: mutation("unvote"),
  };
}
export const usePollData = () => ({
  data: null,
  isLoading: false,
  error: null,
  refetch: () => {},
});
export const useVoterInsights = () => ({
  data: [],
  isLoading: false,
  error: null,
  refetch: () => {},
});
export async function chatRpc(name: string, args: any) {
  await action(name, args);
  if (name === "sync_messages") return fixture.deltas;
  if (name === "create_chat_group_invite")
    return {
      token: "20000000-0000-4000-8000-000000000001",
      expires_at: time(-60),
    };
  if (name === "get_chat_group_invite") {
    if (scenario === "invite-expired") throw new Error("Expired");
    return {
      name: "Creative Circle",
      member_count: 3,
      already_member: scenario === "invite-member",
    };
  }
  if (name === "join_chat_group") return group;
  return null;
}
function query(table: string) {
  let inserts: any[] | null = null,
    ids: string[] | null = null;
  const q: any = {
    select: () => q,
    eq: () => q,
    in: (_column: string, values: string[]) => {
      ids = values;
      return q;
    },
    upsert: (rows: any | any[]) => {
      inserts = Array.isArray(rows) ? rows : [rows];
      return q;
    },
    ilike: () => q,
    order: () => q,
    limit: () => q,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () =>
      Promise.resolve({
        data: {
          username: "hana",
          bio: "Designer, curious maker, and coffee enthusiast.",
        },
        error: null,
      }),
    then: (resolve: any, reject: any) => {
      if (inserts && table === "messages")
        return action("persist-message-batch", inserts)
          .then(
            () => {
              for (const row of inserts!) {
                if (!storedMessages.has(row.id))
                  storedMessages.set(row.id, {
                    ...row,
                    seq: storedMessages.size + 1,
                    created_seq: storedMessages.size + 1,
                  });
              }
              return { data: null, error: null };
            },
            () => ({
              data: null,
              error: {
                code: "NETWORK_ERROR",
                message: "Sample request failed",
              },
            }),
          )
          .then(resolve, reject);
      if (fixture.failures["query:" + table] > 0) {
        fixture.failures["query:" + table]--;
        return Promise.resolve({
          data: null,
          error: new Error("Sample query failed"),
        }).then(resolve);
      }
      return Promise.resolve({
        data:
          table === "messages"
            ? ids
              ? ids.flatMap((id) =>
                  storedMessages.has(id) ? [storedMessages.get(id)] : [],
                )
              : messages
            : table === "message_deletions"
              ? fixture.deletions
              : [],
        error: null,
      }).then(resolve);
    },
  };
  return q;
}
export const supabase = {
  storage: mediaClient.storage,
  from: query,
  rpc: async (name: string, args: any) => {
    if (
      scenario === "group-schema-missing" &&
      name === "create_group_conversation"
    ) {
      await action(name, args);
      return {
        data: null,
        error: { code: "PGRST202", message: "Function signature unavailable" },
      };
    }
    try {
      return { data: await chatRpc(name, args), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  auth: { getUser: async () => ({ data: { user } }) },
  channel: () => ({
    on() {
      return this;
    },
    subscribe() {
      return this;
    },
    send: async () => {},
    unsubscribe() {},
  }),
  removeChannel: () => {},
};
