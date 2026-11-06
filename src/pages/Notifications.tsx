import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Settings,
  CheckCheck,
  Trash2,
  Inbox,
  AlertCircle,
  RefreshCw,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useNotifications } from "@/hooks/useNotifications";
import {
  getNotificationNavTarget,
  type TimeGroup,
} from "@/utils/notificationHelpers";
import {
  notificationPanelEntries,
  type NotificationPanelEntry,
} from "@/lib/notificationPanelEntries";
import NotificationFilters, {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TIME_GROUPS,
} from "@/components/notifications/NotificationFilters";
import NotificationPanelItem from "@/components/notifications/NotificationPanelItem";
import NotificationSettingsModal from "@/components/notifications/NotificationSettingsModal";
import NotificationActionDialog from "@/components/notifications/NotificationActionDialog";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import FooterNav from "@/components/FooterNav";
import "@/components/notifications/notification-panel.css";
import "@/components/notifications/notification-page.css";

type Notice = { text: string; error?: boolean };
export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [category, setCategory] = useState("all");
  const [showPreferences, setShowPreferences] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState("");
  const [reshare, setReshare] = useState<{
    storyId: string;
    mentionerName: string;
  } | null>(null);
  const [resharing, setResharing] = useState(false);
  const [reshareError, setReshareError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false),
    reshareLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null),
    preferencesTrigger = useRef<HTMLButtonElement>(null),
    clearTrigger = useRef<HTMLButtonElement>(null),
    storyTrigger = useRef<HTMLElement | null>(null);
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
    clearAllNotifications,
  } = useNotifications();
  const profileIds = useMemo(
    () =>
      Array.from(
        new Set(
          notifications.flatMap((notification) => {
            const data = notification.data as any;
            return [data?.userId, data?.senderId, data?.mentioner_id].filter(
              Boolean,
            );
          }),
        ),
      ),
    [notifications],
  );
  const { data: profiles = [] } = useQuery({
    queryKey: ["notifications-page-profiles", profileIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url, initials, avatar_color")
        .in("id", profileIds);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
    enabled: profileIds.length > 0,
  });
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("notifications-page-mentions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "push_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as any;
          if (
            notification?.user_id === user.id &&
            ["mention", "story_mention"].includes(
              notification.notification_type,
            )
          )
            toast("Someone mentioned you!", { duration: 4000 });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
  const entries = useMemo(
    () => notificationPanelEntries(notifications, category, profiles),
    [notifications, category, profiles],
  );
  const groups = useMemo(
    () =>
      Object.fromEntries(
        NOTIFICATION_TIME_GROUPS.map((group) => [
          group,
          entries.filter((entry) => entry.group === group),
        ]),
      ) as Record<TimeGroup, NotificationPanelEntry[]>,
    [entries],
  );
  const runAction = async (task: () => Promise<unknown>, success: string) => {
    if (actionLock.current) return false;
    actionLock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await task();
      setNotice({ text: success });
      return true;
    } catch {
      const text = "This change could not be saved. Please try again.";
      setNotice({ text, error: true });
      toast.error(text);
      return false;
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
    const notification = entry.notification;
    const data = notification.data || {};
    if (entry.unreadIds.length) void markEntry(entry);
    if (notification.notification_type === "story_mention" && data.story_id) {
      storyTrigger.current = document.activeElement as HTMLElement;
      setReshareError("");
      setReshare({
        storyId: data.story_id,
        mentionerName:
          profiles.find((profile) => profile.id === data.mentioner_id)?.name ||
          notification.title?.split(" mentioned")[0] ||
          "Someone",
      });
      return;
    }
    const target = getNotificationNavTarget(notification);
    navigate(target.path, target.state ? { state: target.state } : undefined);
  };
  const clearAll = async () => {
    if (actionLock.current) return;
    setClearError("");
    const ok = await runAction(
      () => clearAllNotifications.mutateAsync(),
      "All notifications cleared.",
    );
    if (ok) setConfirmClear(false);
    else setClearError("Notifications could not be cleared. Please try again.");
  };
  const reshareStory = async () => {
    if (!reshare || reshareLock.current) return;
    reshareLock.current = true;
    setResharing(true);
    setReshareError("");
    try {
      const { data: story, error: storyError } = await supabase
        .from("stories")
        .select("media_url, media_type")
        .eq("id", reshare.storyId)
        .single();
      if (storyError || !story)
        throw storyError || new Error("Story unavailable");
      const {
        data: { user: account },
        error: accountError,
      } = await supabase.auth.getUser();
      if (accountError || !account)
        throw accountError || new Error("Not authenticated");
      const { error: insertError } = await supabase.from("stories").insert({
        user_id: account.id,
        media_url: story.media_url,
        media_type: story.media_type,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        reshared_story_id: reshare.storyId,
      } as any);
      if (insertError) throw insertError;
      setReshare(null);
      setNotice({ text: "Story reshared to your profile." });
      toast.success("Story reshared to your profile!");
    } catch {
      setReshareError("This story could not be reshared. Please try again.");
    } finally {
      reshareLock.current = false;
      setResharing(false);
    }
  };
  const showKnownState =
    !(isLoading && !notifications.length) && !(error && !notifications.length);
  return (
    <>
      <div className="notification-ui notification-page">
        <header className="notification-page-header">
          <div className="notification-page-bar">
            <button
              className="notification-icon-button"
              aria-label="Back to home"
              onClick={() => navigate("/")}
            >
              <ArrowLeft aria-hidden="true" />
            </button>
            <div className="notification-page-brand">
              <img src="/lovable-uploads/SerkleMainLogo.svg" alt="" />
              <div>
                <h1 ref={heading} tabIndex={-1}>
                  Notifications
                </h1>
                <p>Your Serkle updates</p>
              </div>
            </div>
            <button
              ref={preferencesTrigger}
              className="notification-icon-button"
              aria-label="Notification preferences"
              onClick={() => setShowPreferences(true)}
            >
              <Settings aria-hidden="true" />
            </button>
          </div>
        </header>
        <main className="notification-page-main">
          <section
            className="notification-page-intro"
            aria-labelledby="notification-page-intro"
          >
            <h2 id="notification-page-intro">Stay in the loop</h2>
            <p>Reactions, messages and community moments.</p>
            <div className="notification-page-summary">
              <div>
                <span className="notification-unread">
                  {!showKnownState ? (
                    isLoading ? (
                      "Checking for updates"
                    ) : (
                      "Updates unavailable"
                    )
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
                      <Check className="size-4" aria-hidden="true" />
                      You’re all caught up
                    </>
                  )}
                </span>
                {showKnownState && <p>Your latest activity</p>}
              </div>
              <button
                className="notification-mark-all"
                disabled={busy || !unreadCount || !showKnownState}
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
          </section>
          <div className="notification-page-filter-bar">
            <NotificationFilters
              value={category}
              unreadCount={unreadCount}
              onChange={(value) => {
                setCategory(value);
                setNotice(null);
              }}
            />
          </div>
          <section
            aria-labelledby="notification-page-activity"
            aria-busy={busy || isLoading}
          >
            <div className="notification-page-list-heading">
              <h2 id="notification-page-activity">
                {category === "all"
                  ? "Recent activity"
                  : `${NOTIFICATION_CATEGORIES.find(([key]) => key === category)?.[1]} updates`}
              </h2>
              {notifications.length > 0 && (
                <button
                  ref={clearTrigger}
                  className="notification-page-clear"
                  disabled={busy}
                  onClick={() => {
                    setClearError("");
                    setConfirmClear(true);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Clear all
                </button>
              )}
            </div>
            {notice && (
              <p
                className={`notification-notice${notice.error ? " notification-notice--error" : ""}`}
                role={notice.error ? "alert" : "status"}
              >
                {notice.text}
              </p>
            )}
            {error && notifications.length > 0 && (
              <div
                className="notification-notice notification-notice--error"
                role="alert"
              >
                Your last loaded updates are shown. New activity could not be
                refreshed.<button onClick={() => void refetch()}>Retry</button>
              </div>
            )}
            {isLoading && !notifications.length ? (
              <div className="notification-state">
                <SerkleLoader
                  size="sm"
                  label="Loading notifications"
                  showText
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
            ) : !entries.length ? (
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
                      : `No ${NOTIFICATION_CATEGORIES.find(([key]) => key === category)?.[1].toLowerCase()} updates yet`}
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
              NOTIFICATION_TIME_GROUPS.map(
                (group) =>
                  groups[group].length > 0 && (
                    <section
                      className="notification-page-day"
                      key={group}
                      aria-label={group}
                    >
                      <h3 className="notification-time-heading">{group}</h3>
                      <ul className="notification-items">
                        {groups[group].map((entry) => (
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
                            onProfile={(id) => navigate(`/profile/${id}`)}
                          />
                        ))}
                      </ul>
                    </section>
                  ),
              )
            )}
            {isFetching && !isLoading && (
              <div className="notification-notice">
                <SerkleLoader
                  size="xs"
                  label="Refreshing notifications"
                  showText
                />
              </div>
            )}
          </section>
          {notifications.length >= 50 && (
            <p className="notification-page-end">
              Showing your latest 50 notifications.
            </p>
          )}
        </main>
        <NotificationActionDialog
          open={confirmClear}
          onOpenChange={setConfirmClear}
          title="Clear all notifications?"
          description="This permanently removes notifications from every category. It cannot be undone."
          confirmLabel="Clear all notifications"
          destructive
          pending={busy}
          error={clearError}
          onConfirm={() => void clearAll()}
          returnFocusRef={clearTrigger}
          fallbackFocusRef={heading}
        />
        <NotificationActionDialog
          open={!!reshare}
          onOpenChange={(open) => {
            if (!open) setReshare(null);
          }}
          title="Reshare to your story?"
          description={`${reshare?.mentionerName || "Someone"} mentioned you in their story. Share it to your own story for 24 hours.`}
          confirmLabel="Reshare story"
          pending={resharing}
          error={reshareError}
          onConfirm={() => void reshareStory()}
          returnFocusRef={storyTrigger}
          fallbackFocusRef={heading}
        />
        {showPreferences && (
          <NotificationSettingsModal
            open={showPreferences}
            onOpenChange={setShowPreferences}
            returnFocusRef={preferencesTrigger}
          />
        )}
      </div>
      <FooterNav active="home" onSelect={() => {}} onOpenCreate={() => {}} />
    </>
  );
}
