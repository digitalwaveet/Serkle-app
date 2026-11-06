import React, { useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, MoreHorizontal, Trash2 } from "lucide-react";
import {
  getNotificationCategory,
  getNotificationIcon,
  formatRelativeTime,
} from "@/utils/notificationHelpers";
import type { NotificationPanelEntry } from "@/lib/notificationPanelEntries";
interface Props {
  entry: NotificationPanelEntry;
  busy: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
  onProfile: (id: string) => void;
}
export default function NotificationPanelItem({
  entry,
  busy,
  onOpen,
  onMarkRead,
  onDelete,
  onProfile,
}: Props) {
  const { notification, title, body, profiles } = entry;
  const profile = profiles[0];
  const [imageFailed, setImageFailed] = useState(false);
  const Icon = getNotificationIcon(notification.notification_type);
  const category = getNotificationCategory(notification.notification_type);
  const unread = entry.unreadIds.length > 0;
  const urgent = category === "safety" && unread;
  const timestamp = notification.sent_at || notification.created_at;
  const validTime = timestamp && Number.isFinite(new Date(timestamp).getTime());
  const avatar = (
    <>
      {profile ? (
        profile.avatar_url && !imageFailed ? (
          <img
            src={profile.avatar_url}
            alt=""
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="notification-avatar-initials">
            {profile.initials || profile.name?.slice(0, 1) || "?"}
          </span>
        )
      ) : (
        <Icon aria-hidden="true" />
      )}
      {profile && (
        <span className="notification-avatar-icon">
          <Icon aria-hidden="true" />
        </span>
      )}
      {entry.count > 1 && (
        <span
          className="notification-avatar-more"
          aria-label={`${entry.count} updates`}
        >
          {entry.count}
        </span>
      )}
    </>
  );
  return (
    <li
      className="notification-entry"
      data-testid={`notification-${entry.id}`}
      data-unread={unread}
      data-urgent={urgent}
    >
      {profile && entry.count === 1 ? (
        <button
          className="notification-avatar"
          aria-label={`View ${profile.name || profile.username || "member"}’s profile`}
          onClick={() => onProfile(profile.id)}
        >
          {avatar}
        </button>
      ) : (
        <span className="notification-avatar" aria-hidden="true">
          {avatar}
        </span>
      )}
      <button className="notification-open" onClick={onOpen}>
        <span className="notification-entry-title">{title}</span>
        {body && <span className="notification-entry-body">{body}</span>}
        <span className="notification-entry-meta">
          <span>
            {category === "other"
              ? "Serkle"
              : category.charAt(0).toUpperCase() + category.slice(1)}
          </span>
          <span aria-hidden="true">·</span>
          {validTime ? (
            <time
              dateTime={timestamp}
              title={new Date(timestamp).toLocaleString()}
            >
              {formatRelativeTime(timestamp)}
            </time>
          ) : (
            <span>Time unavailable</span>
          )}
          {unread && (
            <span className="notification-entry-state">
              <span className="notification-unread-dot" aria-hidden="true" />
              Unread
            </span>
          )}
          {urgent && <span className="notification-urgent">Urgent</span>}
        </span>
      </button>
      <Menu.Root>
        <Menu.Trigger
          className="notification-icon-button"
          aria-label={`Options for ${title}`}
          disabled={busy}
        >
          <MoreHorizontal aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            className="notification-ui notification-menu"
            align="end"
            sideOffset={4}
            collisionPadding={12}
            aria-label="Notification actions"
          >
            {unread && (
              <Menu.Item onSelect={onMarkRead} disabled={busy}>
                <Check aria-hidden="true" />
                Mark as read
              </Menu.Item>
            )}
            <Menu.Item
              className="notification-delete"
              onSelect={onDelete}
              disabled={busy}
            >
              <Trash2 aria-hidden="true" />
              {entry.ids.length > 1
                ? `Delete ${entry.ids.length} notifications`
                : "Delete notification"}
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </li>
  );
}
