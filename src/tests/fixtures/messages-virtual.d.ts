declare module "*?messaging-actual" {
  export const syncConversation: typeof import("../../lib/sync").syncConversation;
  export const processSyncQueue: typeof import("../../lib/sync").processSyncQueue;
  export const useRetryMessage: typeof import("../../hooks/useMessages").useRetryMessage;
  export const useSendMessage: typeof import("../../hooks/useMessages").useSendMessage;
  export const useUnreadCount: typeof import("../../hooks/useUnreadCount").useUnreadCount;
}
declare module "*MediaGroupMosaic.tsx?messaging-media" {
  const component: typeof import("../../components/messages/MediaGroupMosaic").default;
  export default component;
}
declare module "*MessageBubble.tsx?messaging-media" {
  const component: typeof import("../../components/messages/MessageBubble").default;
  export default component;
}
declare module "*MediaLightbox.tsx?messaging-media" {
  const component: typeof import("../../components/messages/MediaLightbox").default;
  export default component;
}
