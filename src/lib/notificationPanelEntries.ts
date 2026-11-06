import {
  batchNotifications,
  filterByCategory,
  getTimeGroup,
  type TimeGroup,
} from "../utils/notificationHelpers.ts";

export interface NotificationPanelEntry {
  id: string;
  notification: any;
  ids: string[];
  unreadIds: string[];
  title: string;
  body: string;
  profiles: any[];
  count: number;
  group: TimeGroup;
}

/** Adapt the existing batch format without losing IDs or older unread items. */
export function notificationPanelEntries(
  notifications: any[],
  category: string,
  profiles: any[] = [],
): NotificationPanelEntry[] {
  const lookup = (id: string) => profiles.find((profile) => profile.id === id);
  const byId = new Map(
    notifications.map((notification) => [notification.id, notification]),
  );
  return batchNotifications(
    filterByCategory(notifications, category),
    lookup,
  ).map((item) => {
    const batch = !!item.latest && Array.isArray(item.ids);
    const notification = batch ? item.latest : item;
    const ids: string[] = batch
      ? item.ids
      : item._groupItemIds || [notification.id];
    const people = batch
      ? item.profiles
      : [
          lookup(notification.data?.userId || notification.data?.senderId),
        ].filter(Boolean);
    const count = batch ? item.count : ids.length;
    let title = notification.title || "Notification";
    if (batch) {
      const names = people
        .map((person: any) => person.name || person.username)
        .filter(Boolean);
      const others = count - Math.min(names.length, 2);
      const subject = !names.length
        ? `${count} people`
        : names.length === 1
          ? `${names[0]}${others > 0 ? ` and ${others} ${others === 1 ? "other person" : "others"}` : ""}`
          : `${names[0]}${count === 2 ? " and " : ", "}${names[1]}${others > 0 ? ` and ${others} ${others === 1 ? "other person" : "others"}` : ""}`;
      const action =
        (
          {
            like: "liked your post",
            comment: "commented on your post",
            follow: "started following you",
          } as Record<string, string>
        )[notification.notification_type] || "shared an update";
      title = `${subject} ${action}`;
    }
    return {
      id: notification.id,
      notification,
      ids,
      unreadIds: ids.filter((id) => !byId.get(id)?.read_at),
      title,
      body: batch ? item.batchBody || "" : notification.body || "",
      profiles: people,
      count,
      group: getTimeGroup(notification.sent_at || notification.created_at),
    };
  });
}
