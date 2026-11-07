import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Send, User, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { usePresence } from "@/hooks/usePresence";
import { useSharedChatHistory } from "@/hooks/useSharedChatHistory";
import type { SharedMessage } from "@/lib/messagingPresentation";
import MessagingProfileFrame from "./MessagingProfileFrame";
import SharedChatContent from "./SharedChatContent";
import { MessagingLoading } from "./MessagingState";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: SharedMessage[];
  profileName: string;
  profileAvatar?: string | null;
  profileInitials: string;
  isGroup: boolean;
  memberCount?: number;
  otherUserId?: string | null;
  otherUserUsername?: string | null;
  onViewProfile: () => void;
  onMediaSelect?: (reference: string, type: "photo" | "video") => void;
  conversationId?: string;
  currentUserId?: string;
  onSearch?: () => void;
  onViewMessage?: (id: string) => void;
  presentation?: "dialog" | "panel";
}
export default function ChatMediaGalleryModal({
  isOpen,
  onClose,
  messages: localMessages,
  profileName,
  profileAvatar,
  profileInitials,
  otherUserId,
  otherUserUsername,
  onViewProfile,
  onMediaSelect,
  conversationId,
  currentUserId,
  onSearch,
  onViewMessage,
  presentation,
}: Props) {
  const { isUserOnline, getLastSeenText } = usePresence(currentUserId);
  const profile = useQuery({
    queryKey: ["chat-public-profile", otherUserId],
    enabled: isOpen && !!otherUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username,bio")
        .eq("id", otherUserId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const history = useSharedChatHistory(conversationId, isOpen);
  const messages = useMemo(() => {
    const map = new Map(
      history.messages.map((message) => [message.id, message]),
    );
    localMessages.forEach((message) => map.set(message.id, message));
    return [...map.values()];
  }, [history.messages, localMessages]);
  const closeAnd = (callback?: () => void) => {
    if (presentation !== "panel") {
      onClose();
      if (callback) setTimeout(callback, 100);
    } else callback?.();
  };
  return (
    <MessagingProfileFrame
      open={isOpen}
      onClose={onClose}
      title="Contact profile"
      presentation={presentation}
    >
      <div className="msg-profile-hero">
        <Avatar className="msg-avatar">
          <AvatarImage src={profileAvatar || undefined} alt="" />
          <AvatarFallback className="msg-avatar">
            {profileInitials || profileName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <h2>{profileName}</h2>
        {(profile.data?.username || otherUserUsername) && (
          <p>@{profile.data?.username || otherUserUsername}</p>
        )}
        <p>
          {otherUserId && isUserOnline(otherUserId)
            ? "Online"
            : getLastSeenText(otherUserId || "") || "Presence unavailable"}
        </p>
      </div>
      <div className="msg-quick-actions">
        <button onClick={onClose}>
          <Send aria-hidden="true" />
          Message
        </button>
        <button onClick={() => closeAnd(onSearch)} disabled={!onSearch}>
          <Search aria-hidden="true" />
          Search chat
        </button>
        <button onClick={() => closeAnd(onViewProfile)}>
          <User aria-hidden="true" />
          View profile
        </button>
      </div>
      {profile.isLoading ? (
        <MessagingLoading label="Loading profile details" />
      ) : profile.error ? (
        <p className="msg-error" role="alert">
          Profile details couldn’t be loaded.
          <button
            className="msg-button quiet"
            onClick={() => void profile.refetch()}
          >
            Retry profile
          </button>
        </p>
      ) : profile.data?.bio ? (
        <section className="msg-panel">
          <div className="msg-panel-heading">About</div>
          <p>{profile.data.bio}</p>
        </section>
      ) : null}
      <div className="msg-section-title">
        <h3>Shared content</h3>
        <span className="text-xs text-muted-foreground">This conversation</span>
      </div>
      {history.error && (
        <p className="msg-error" role="alert">
          Older shared content couldn’t be loaded. Your loaded messages are
          still available.
          <button
            className="msg-button quiet"
            onClick={() => void history.refetch()}
          >
            Retry shared content
          </button>
        </p>
      )}
      {history.isLoading && !messages.length ? (
        <MessagingLoading label="Loading shared content" />
      ) : (
        <SharedChatContent
          messages={messages}
          onMediaSelect={
            onMediaSelect
              ? (url, type) => closeAnd(() => onMediaSelect(url, type))
              : undefined
          }
          onViewMessage={
            onViewMessage
              ? (id) => closeAnd(() => onViewMessage(id))
              : undefined
          }
        />
      )}
      {history.hasNextPage && (
        <button
          className="msg-button secondary w-full mt-4"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {history.isFetchingNextPage
            ? "Loading older messages…"
            : "Load older shared content"}
        </button>
      )}
    </MessagingProfileFrame>
  );
}
