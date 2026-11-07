import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  PenSquare,
  Search,
  Users,
  WifiOff,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useConversations,
  useCreateConversation,
} from "@/hooks/useConversations";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import ConversationsList from "@/components/messages/ConversationsList";
import ChatView from "@/components/messages/ChatView";
import CreateGroupModal from "@/components/messages/CreateGroupModal";
import NewConversationModal from "@/components/messages/NewConversationModal";
import MessageBadge from "@/components/messages/MessageBadge";
import InviteGroupDialog from "@/components/messages/InviteGroupDialog";
import { circleLoginPath } from "@/lib/authReturnPath";
import {
  MessagingLoading,
  MessagingState,
} from "@/components/messages/MessagingState";
import { messageCount } from "@/lib/messagingPresentation";
import "@/components/messages/messages.css";
export default function Messages() {
  const navigate = useNavigate(),
    location = useLocation(),
    { conversationId } = useParams(),
    [params] = useSearchParams();
  const { user, isLoading: userLoading } = useUser();
  const { conversations, isLoading, isSyncing, error, refetch } =
    useConversations(user?.id);
  const {
    totalUnreadCount,
    unreadConversationCount,
    isLoading: countsLoading,
  } = useUnreadCount();
  const { createConversation } = useCreateConversation();
  const [groupOpen, setGroupOpen] = useState(false),
    [newOpen, setNewOpen] = useState(false),
    [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all"),
    [opening, setOpening] = useState(false),
    [openError, setOpenError] = useState("");
  const [online, setOnline] = useState(navigator.onLine),
    openingKey = useRef("");
  const [openAttempt, setOpenAttempt] = useState(0);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const legacy = params.get("conversationId"),
      message = params.get("messageId");
    if (!conversationId && legacy && /^[0-9a-f-]{36}$/i.test(legacy))
      navigate(
        `/messages/${legacy}${message && /^[0-9a-f-]{36}$/i.test(message) ? "?messageId=" + message : ""}`,
        { replace: true },
      );
  }, [params, conversationId, navigate]);
  useEffect(() => {
    if (params.get("createGroup") === "true") {
      setGroupOpen(true);
      navigate("/messages", { replace: true });
    }
  }, [params, navigate]);
  useEffect(() => {
    const other = params.get("userId");
    if (!other || !user?.id || conversationId) return;
    const key = `${user.id}:${other}`;
    if (openingKey.current === key) return;
    openingKey.current = key;
    setOpening(true);
    setOpenError("");
    void createConversation(user.id, other)
      .then((id) => navigate(`/messages/${id}`, { replace: true }))
      .catch(() =>
        setOpenError(
          "This conversation could not be opened. Please try again.",
        ),
      )
      .finally(() => setOpening(false));
  }, [
    params,
    user?.id,
    conversationId,
    createConversation,
    navigate,
    openAttempt,
  ]);
  useEffect(() => {
    if (!userLoading && !user)
      navigate(circleLoginPath(location.pathname + location.search), {
        replace: true,
      });
  }, [userLoading, user, navigate, location.pathname, location.search]);
  if (!user)
    return (
      <div className="msg-ui msg-page">
        <MessagingLoading label="Loading your messages" />
      </div>
    );
  const selected = conversations.find(
    (c) => c.conversation_id === conversationId,
  );
  const select = (id: string) => navigate(`/messages/${id}`);
  const retryOpen = () => {
    openingKey.current = "";
    setOpenAttempt((value) => value + 1);
    void refetch();
  };
  return (
    <main className="msg-ui msg-page" data-testid="messages-page">
      {(params.has("invite") || params.has("join_group")) && (
        <InviteGroupDialog
          key={params.get("invite") || "legacy"}
          token={params.get("invite") || "invalid-legacy-link"}
          userId={user.id}
          onClose={() => navigate("/messages", { replace: true })}
          onJoined={(id) => navigate(`/messages/${id}`, { replace: true })}
        />
      )}
      <div className="msg-workspace">
        <section
          className={`msg-inbox ${conversationId ? "hide-mobile" : ""}`}
          aria-label="Conversations"
        >
          <header className="msg-inbox-header">
            <div className="msg-eyebrow">Serkle messages</div>
            <div className="msg-inbox-heading">
              <button
                className="msg-icon text-white -ml-2"
                aria-label="Back to home"
                title="Back to home"
                onClick={() => navigate("/")}
              >
                <ArrowLeft aria-hidden="true" />
              </button>
              <h1>Messages</h1>
              <MessageBadge
                count={countsLoading ? undefined : totalUnreadCount}
              />
              <button
                className="msg-icon"
                aria-label="New message"
                onClick={() => setNewOpen(true)}
              >
                <PenSquare aria-hidden="true" />
              </button>
            </div>
            <p>
              {countsLoading
                ? "Checking unread messages…"
                : totalUnreadCount
                  ? `${messageCount(totalUnreadCount, "unread message")} in ${messageCount(unreadConversationCount, "chat")}`
                  : "You’re all caught up."}
            </p>
          </header>
          <div className="msg-search">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="conversation-search">
              Search conversations
            </label>
            <input
              id="conversation-search"
              type="search"
              placeholder="Search conversations"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div
            className="msg-filters"
            role="group"
            aria-label="Filter conversations"
          >
            {(["all", "unread", "groups"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={value === filter}
                onClick={() => setFilter(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "unread"
                    ? "Unread"
                    : "Groups"}
                {value === "unread" && !countsLoading && (
                  <span
                    className="msg-badge"
                    aria-label={messageCount(
                      unreadConversationCount,
                      "unread chat",
                    )}
                  >
                    {unreadConversationCount > 99
                      ? "99+"
                      : unreadConversationCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="msg-inbox-list">
            {openError && (
              <div className="msg-error mx-4" role="alert">
                {openError}
                <button className="msg-button quiet" onClick={retryOpen}>
                  Retry opening conversation
                </button>
              </div>
            )}
            {error && (
              <div className="msg-error mx-4" role="alert">
                Conversations couldn’t be refreshed. Saved conversations are
                still available.
                <button
                  className="msg-button quiet"
                  disabled={isSyncing}
                  onClick={() => void refetch()}
                >
                  Retry refresh
                </button>
              </div>
            )}
            <ConversationsList
              conversations={conversations}
              selectedConversationId={conversationId || null}
              onSelectConversation={select}
              isLoading={isLoading || opening}
              currentUserId={user.id}
              search={search}
              filter={filter}
            />
            <div className="msg-sync-note">
              {!online ? (
                <>
                  <WifiOff aria-hidden="true" />
                  Offline · Showing saved conversations
                </>
              ) : isSyncing ? (
                "Refreshing conversations…"
              ) : (
                !error && (
                  <>
                    <Check aria-hidden="true" />
                    Messages are up to date
                  </>
                )
              )}
            </div>
          </div>
          <div className="msg-inbox-footer">
            <button
              className="msg-button primary"
              onClick={() => setGroupOpen(true)}
            >
              <Users aria-hidden="true" />
              New group
            </button>
          </div>
        </section>
        <section
          className={`msg-chat-region ${!conversationId ? "hide-mobile" : ""}`}
          aria-label="Current conversation"
        >
          {selected ? (
            <ChatView
              key={selected.conversation_id}
              conversation={selected}
              currentUserId={user.id}
              currentUserAvatar={user.avatar}
              currentUserInitials={user.initials}
              currentUserName={user.name}
              onBack={() => navigate("/messages")}
            />
          ) : conversationId ? (
            isLoading || isSyncing ? (
              <MessagingLoading />
            ) : (
              <MessagingState
                title="Conversation unavailable"
                description="This conversation may no longer be available to your account."
                onRetry={() => void refetch()}
              />
            )
          ) : (
            <MessagingState
              title="Your conversations, together"
              description="Choose a conversation to continue, or start a new message."
            />
          )}
        </section>
      </div>
      {groupOpen && (
        <CreateGroupModal
          open
          onClose={() => setGroupOpen(false)}
          currentUserId={user.id}
          onGroupCreated={select}
        />
      )}
      {newOpen && (
        <NewConversationModal
          open
          onClose={() => setNewOpen(false)}
          currentUserId={user.id}
          onCreated={select}
        />
      )}
    </main>
  );
}
