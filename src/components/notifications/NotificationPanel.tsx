import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type CSSProperties,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Settings,
  ArrowRight,
  X,
  Inbox,
  Check,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useNotifications";
import {
  getNotificationNavTarget,
  type TimeGroup,
} from "@/utils/notificationHelpers";
import {
  notificationPanelEntries,
  type NotificationPanelEntry,
} from "@/lib/notificationPanelEntries";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import NotificationPanelItem from "./NotificationPanelItem";
import NotificationSettingsModal from "./NotificationSettingsModal";
import "./notification-panel.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: RefObject<HTMLButtonElement>;
}
const categories = [
  ["all", "All"],
  ["unread", "Unread"],
  ["social", "Social"],
  ["circles", "Circles"],
  ["shop", "Shop"],
  ["safety", "Safety"],
  ["messages", "Messages"],
] as const;
const groupKeys: TimeGroup[] = ["Today", "Yesterday", "This Week", "Earlier"];

export default function NotificationPanel({
  isOpen,
  onClose,
  anchorRef,
}: Props) {
  const navigate = useNavigate();
  const [category, setCategory] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const {
    notifications,
    isLoading,
    isFetching,
    error,
    refetch,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  useEffect(() => {
    if (!isOpen) setShowSettings(false);
    else setNotice(null);
  }, [isOpen]);
  useLayoutEffect(() => {
    if (!isOpen) return;
    opener.current =
      anchorRef?.current || (document.activeElement as HTMLElement);
    const place = () => {
      const rect = anchorRef?.current?.getBoundingClientRect();
      const width = Math.min(440, window.innerWidth - 24);
      const top = Math.max(
        12,
        Math.min(rect ? rect.bottom + 12 : 56, window.innerHeight - 180),
      );
      const left = Math.max(
        12,
        Math.min(
          rect ? rect.right - width : (window.innerWidth - width) / 2,
          window.innerWidth - width - 12,
        ),
      );
      setPosition({
        "--notification-top": `${top}px`,
        "--notification-left": `${left}px`,
      } as CSSProperties);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [isOpen, anchorRef]);
  const profileIds = useMemo(
    () =>
      Array.from(
        new Set(
          notifications
            .map(
              (row) => (row.data as any)?.userId || (row.data as any)?.senderId,
            )
            .filter(Boolean),
        ),
      ),
    [notifications],
  );
  const { data: profiles = [] } = useQuery({
    queryKey: ["notification-panel-profiles", profileIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url, initials, avatar_color")
        .in("id", profileIds);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
    enabled: isOpen && profileIds.length > 0,
  });
  const entries = useMemo(
    () => notificationPanelEntries(notifications, category, profiles),
    [notifications, category, profiles],
  );
  const groups = useMemo(
    () =>
      Object.fromEntries(
        groupKeys.map((group) => [
          group,
          entries.filter((entry) => entry.group === group),
        ]),
      ) as Record<TimeGroup, NotificationPanelEntry[]>,
    [entries],
  );
  const runAction = async (task: () => Promise<unknown>, success?: string) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await task();
      if (success) setNotice({ text: success });
    } catch {
      const text = "This change could not be saved. Please try again.";
      setNotice({ text, error: true });
      toast.error(text);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const markEntry = (entry: NotificationPanelEntry) =>
    runAction(
      () =>
        Promise.all(entry.unreadIds.map((id) => markAsRead.mutateAsync(id))),
      "Marked as read.",
    );
  const openEntry = (entry: NotificationPanelEntry) => {
    if (entry.unreadIds.length) void markEntry(entry);
    const target = getNotificationNavTarget(entry.notification);
    onClose();
    navigate(target.path, target.state ? { state: target.state } : undefined);
  };
  const seeAll = () => {
    onClose();
    navigate("/notifications");
  };
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="notification-backdrop"
          onPointerDown={(event) => {
            if (
              event.target === event.currentTarget &&
              event.button === 0 &&
              !event.ctrlKey
            )
              onClose();
          }}
        />
        <Dialog.Content
          className="notification-ui notification-panel"
          style={position}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
        >
          <header className="notification-header">
            <div className="notification-heading">
              <span className="notification-heading-icon">
                <Bell aria-hidden="true" />
              </span>
              <div className="notification-heading-copy">
                <Dialog.Title>Notifications</Dialog.Title>
                <Dialog.Description>
                  Your latest activity, in one place.
                </Dialog.Description>
              </div>
              <button
                ref={settingsTrigger}
                className="notification-icon-button"
                aria-label="Notification preferences"
                onClick={() => setShowSettings(true)}
              >
                <Settings aria-hidden="true" />
              </button>
              <Dialog.Close
                className="notification-icon-button"
                aria-label="Close notifications"
              >
                <X aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="notification-toolbar">
              <span className="notification-unread">
                {isLoading && !notifications.length ? (
                  "Checking for updates"
                ) : error && !notifications.length ? (
                  "Updates unavailable"
                ) : unreadCount > 0 ? (
                  <>
                    <span
                      className="notification-unread-dot"
                      aria-hidden="true"
                    />
                    {unreadCount} unread
                  </>
                ) : (
                  <>
                    <Check aria-hidden="true" className="size-4" />
                    You’re all caught up
                  </>
                )}
              </span>
              <button
                className="notification-mark-all"
                disabled={
                  busy || !unreadCount || (isLoading && !notifications.length)
                }
                onClick={() =>
                  void runAction(
                    () => markAllAsRead.mutateAsync(),
                    "All notifications marked as read.",
                  )
                }
              >
                <CheckCheck aria-hidden="true" />
                {busy ? "Updating…" : "Mark all read"}
              </button>
            </div>
          </header>
          <div
            className="notification-filters"
            role="group"
            aria-label="Filter notifications"
          >
            {categories.map(([value, label]) => (
              <button
                className="notification-filter"
                key={value}
                aria-pressed={category === value}
                aria-label={
                  value === "unread" && unreadCount > 0
                    ? `Unread, ${unreadCount} notifications`
                    : label
                }
                onClick={() => {
                  setCategory(value);
                  setNotice(null);
                }}
              >
                {label}
                {value === "unread" && unreadCount > 0 && (
                  <span className="notification-filter-count">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="notification-list" aria-busy={isLoading || busy}>
            {notice && (
              <div
                className={`notification-notice${notice.error ? " notification-notice--error" : ""}`}
                role={notice.error ? "alert" : "status"}
              >
                {notice.text}
              </div>
            )}
            {error && notifications.length > 0 && (
              <div
                role="alert"
                className="notification-notice notification-notice--error"
              >
                These are your last loaded notifications. Updates could not be
                refreshed.<button onClick={() => void refetch()}>Retry</button>
              </div>
            )}
            {isLoading && !notifications.length ? (
              <div className="notification-state">
                <SerkleLoader
                  size="sm"
                  showText
                  label="Loading notifications"
                />
              </div>
            ) : error && !notifications.length ? (
              <div className="notification-state">
                <span className="notification-state-icon">
                  <AlertCircle aria-hidden="true" />
                </span>
                <h3>Couldn’t load notifications</h3>
                <p>Your updates are still there. Try loading them again.</p>
                <button
                  className="notification-button"
                  onClick={() => void refetch()}
                >
                  <RefreshCw aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : entries.length === 0 ? (
              <div className="notification-state">
                <span className="notification-state-icon">
                  {category === "unread" ? (
                    <CheckCheck aria-hidden="true" />
                  ) : (
                    <Inbox aria-hidden="true" />
                  )}
                </span>
                <h3>
                  {category === "unread"
                    ? "You’re all caught up"
                    : category === "all"
                      ? "Your updates start here"
                      : `No ${categories.find(([value]) => value === category)?.[1].toLowerCase()} updates yet`}
                </h3>
                <p>
                  {category === "unread"
                    ? "You’ve read all your latest updates."
                    : category === "all"
                      ? "Reactions, conversations and community moments will appear here."
                      : "New activity in this category will appear here."}
                </p>
                {category !== "all" && (
                  <button
                    className="notification-button"
                    onClick={() => setCategory("all")}
                  >
                    Show all notifications
                  </button>
                )}
              </div>
            ) : (
              groupKeys.map(
                (group) =>
                  groups[group].length > 0 && (
                    <section key={group} aria-label={group}>
                      <h3 className="notification-time-heading">{group}</h3>
                      <ul className="notification-items">
                        {groups[group].slice(0, 15).map((entry) => (
                          <NotificationPanelItem
                            key={entry.id}
                            entry={entry}
                            busy={busy}
                            onOpen={() => openEntry(entry)}
                            onMarkRead={() => void markEntry(entry)}
                            onDelete={() =>
                              void runAction(
                                () => deleteNotification.mutateAsync(entry.ids),
                                "Notification removed.",
                              )
                            }
                            onProfile={(id) => {
                              onClose();
                              navigate(`/profile/${id}`);
                            }}
                          />
                        ))}
                      </ul>
                      {groups[group].length > 15 && (
                        <p className="notification-notice">
                          More updates from {group.toLowerCase()} are available
                          in all notifications.
                        </p>
                      )}
                    </section>
                  ),
              )
            )}
            {isFetching && !isLoading && (
              <div role="status" className="notification-notice">
                <SerkleLoader
                  size="xs"
                  label="Refreshing notifications"
                  showText
                />
              </div>
            )}
          </div>
          <footer className="notification-footer">
            <button className="notification-button" onClick={seeAll}>
              View all notifications
              <ArrowRight aria-hidden="true" />
            </button>
          </footer>
          {showSettings && (
            <NotificationSettingsModal
              open={showSettings}
              onOpenChange={setShowSettings}
              returnFocusRef={settingsTrigger}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
