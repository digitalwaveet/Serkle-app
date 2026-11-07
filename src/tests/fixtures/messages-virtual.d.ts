declare module "*?messaging-actual" {
  export const syncConversation: typeof import("../../lib/sync").syncConversation;
  export const useSendMessage: typeof import("../../hooks/useMessages").useSendMessage;
  export const useUnreadCount: typeof import("../../hooks/useUnreadCount").useUnreadCount;
}
