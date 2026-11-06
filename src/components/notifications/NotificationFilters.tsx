import React from "react";
import type { TimeGroup } from "@/utils/notificationHelpers";

export const NOTIFICATION_CATEGORIES = [
  ["all", "All"],
  ["unread", "Unread"],
  ["social", "Social"],
  ["circles", "Circles"],
  ["shop", "Shop"],
  ["safety", "Safety"],
  ["messages", "Messages"],
] as const;
export const NOTIFICATION_TIME_GROUPS: TimeGroup[] = [
  "Today",
  "Yesterday",
  "This Week",
  "Earlier",
];

export default function NotificationFilters({
  value,
  unreadCount,
  onChange,
}: {
  value: string;
  unreadCount: number;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="notification-filters"
      role="group"
      aria-label="Filter notifications"
    >
      {NOTIFICATION_CATEGORIES.map(([key, label]) => (
        <button
          className="notification-filter"
          key={key}
          aria-pressed={value === key}
          aria-label={
            key === "unread" && unreadCount > 0
              ? `Unread, ${unreadCount} notifications`
              : label
          }
          onClick={() => onChange(key)}
        >
          {label}
          {key === "unread" && unreadCount > 0 && (
            <span className="notification-filter-count">{unreadCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}
