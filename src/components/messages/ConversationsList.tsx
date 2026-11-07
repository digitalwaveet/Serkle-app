import { useState } from "react";
import { Pin, MoreHorizontal, PinOff, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Conversation,
  usePinnedConversations,
  useTogglePin,
} from "@/hooks/useConversations";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useGlobalTyping } from "@/hooks/useGlobalTyping";
import { messageDate } from "@/lib/messagingPresentation";
import MessageBadge from "./MessageBadge";
import { MessagingLoading, MessagingState } from "./MessagingState";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "./MessagingDialog";
interface Props {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  isLoading: boolean;
  currentUserId: string;
  search?: string;
  filter?: "all" | "unread" | "groups";
}
export default function ConversationsList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  isLoading,
  currentUserId,
  search = "",
  filter = "all",
}: Props) {
  const { getUnreadCountForConversation, isLoading: countsLoading } =
    useUnreadCount();
  const { getTypingText, isTyping } = useGlobalTyping(
    conversations.map((c) => c.conversation_id),
    currentUserId,
  );
  const pinned = usePinnedConversations(currentUserId),
    { togglePin } = useTogglePin();
  const [menu, setMenu] = useState<Conversation | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const visible = conversations
    .filter(
      (c) =>
        (filter !== "groups" || c.is_group) &&
        (filter !== "unread" ||
          getUnreadCountForConversation(c.conversation_id) > 0) &&
        `${c.group_name || c.other_user_name} ${c.last_message || ""}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(pinned.has(b.conversation_id)) -
          Number(pinned.has(a.conversation_id)) ||
        (Date.parse(b.last_message_at || "") || 0) -
          (Date.parse(a.last_message_at || "") || 0),
    );
  if (isLoading || (filter === "unread" && countsLoading))
    return <MessagingLoading />;
  if (!visible.length)
    return (
      <MessagingState
        title={
          search
            ? "No matching conversations"
            : filter === "unread"
              ? "You’re all caught up"
              : filter === "groups"
                ? "No group conversations yet"
                : "Start a conversation"
        }
        description={
          search
            ? "Try another name or message."
            : "Message someone from their profile, or start a group with your friends."
        }
      />
    );
  return (
    <>
      <div className="msg-list-label">
        <Pin aria-hidden="true" />
        {filter === "all"
          ? "Pinned first"
          : filter === "unread"
            ? "Unread conversations"
            : "Group conversations"}
      </div>
      {visible.map((c) => {
        const unread = getUnreadCountForConversation(c.conversation_id),
          name = c.is_group
            ? c.group_name || "Group conversation"
            : c.other_user_name || "Community member";
        return (
          <div
            className={`msg-conversation-wrap ${unread > 0 ? "unread" : ""}`}
            key={c.conversation_id}
            data-testid={`conversation-${c.conversation_id}`}
          >
            <button
              className="msg-conversation"
              aria-label={`${name}${unread > 0 ? `, ${unread} unread ${unread === 1 ? "message" : "messages"}` : ""}`}
              aria-current={
                selectedConversationId === c.conversation_id
                  ? "page"
                  : undefined
              }
              onClick={() => onSelectConversation(c.conversation_id)}
            >
              <Avatar className="msg-avatar">
                <AvatarImage
                  src={
                    (c.is_group ? c.group_avatar_url : c.other_user_avatar) ||
                    undefined
                  }
                  alt=""
                />
                <AvatarFallback className="msg-avatar">
                  {c.is_group ? (
                    <Users className="size-5" aria-hidden="true" />
                  ) : (
                    c.other_user_initials || name.slice(0, 2)
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="msg-conversation-copy">
                <span className="msg-conversation-top">
                  <h3>
                    {pinned.has(c.conversation_id) && (
                      <Pin
                        className="inline size-3 mr-1.5"
                        aria-label="Pinned"
                      />
                    )}
                    {name}
                  </h3>
                  <time dateTime={c.last_message_at || undefined}>
                    {messageDate(c.last_message_at)}
                  </time>
                </span>
                <span className="msg-conversation-bottom">
                  <p>
                    {isTyping(c.conversation_id)
                      ? getTypingText(c.conversation_id)
                      : c.last_message || "No messages yet"}
                  </p>
                  <MessageBadge count={countsLoading ? undefined : unread} />
                </span>
              </span>
            </button>
            <button
              className="msg-icon msg-conversation-menu"
              aria-label={`Options for ${name}`}
              onClick={() => {
                setError("");
                setMenu(c);
              }}
            >
              <MoreHorizontal aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <Dialog
        open={!!menu}
        onOpenChange={(open) => {
          if (!open && !pending) setMenu(null);
        }}
      >
        <DialogContent busy={pending}>
          <DialogHeader>
            <DialogTitle>Conversation options</DialogTitle>
            <DialogDescription>
              {menu?.group_name || menu?.other_user_name}
            </DialogDescription>
          </DialogHeader>
          <div className="msg-dialog-body">
            {error && (
              <p className="msg-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="msg-setting"
              disabled={pending}
              onClick={async () => {
                if (!menu || pending) return;
                setPending(true);
                setError("");
                try {
                  await togglePin(
                    currentUserId,
                    menu.conversation_id,
                    !pinned.has(menu.conversation_id),
                  );
                  setMenu(null);
                } catch {
                  setError(
                    "This conversation could not be updated. Please try again.",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              {menu && pinned.has(menu.conversation_id) ? (
                <PinOff aria-hidden="true" />
              ) : (
                <Pin aria-hidden="true" />
              )}
              {menu && pinned.has(menu.conversation_id)
                ? "Unpin conversation"
                : "Pin conversation"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
