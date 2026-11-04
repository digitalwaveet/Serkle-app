import {
  Heart, MessageCircle, UserPlus, Video, AtSign, Users,
  HelpCircle, Bell, ShoppingBag, AlertTriangle, Calendar,
  Gift, Star, Truck, Package, ShieldAlert, MessageSquare,
  type LucideIcon,
} from 'lucide-react';

// ─── Notification Types ─────────────────────────────────────────────

export type NotifCategory = 'social' | 'circles' | 'shop' | 'safety' | 'messages' | 'other';

export type NotifPriority = 'critical' | 'high' | 'normal' | 'low';

export interface BatchedNotification {
  /** The most-recent notification in the group */
  latest: any;
  /** All notification IDs in this batch */
  ids: string[];
  /** How many notifications are grouped */
  count: number;
  /** Combined display title */
  batchTitle: string;
  /** Combined body text */
  batchBody: string;
  /** Up to 3 user profiles for avatar stacking */
  profiles: Array<{ id: string; name?: string; avatar_url?: string; initials?: string; avatar_color?: string }>;
}

export type TimeGroup = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';

// ─── Icon Mapping ───────────────────────────────────────────────────

export const NOTIFICATION_ICON_MAP: Record<string, LucideIcon> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  new_post: MessageCircle,
  new_video: Video,
  story_mention: AtSign,
  mention: AtSign,
  live_start: Video,
  circle_member: Users,
  circle_post: Users,
  circle_event: Calendar,
  circle_invite: Users,
  question_answer: HelpCircle,
  answer_vote: HelpCircle,
  order: ShoppingBag,
  order_update: Package,
  order_shipped: Truck,
  order_delivered: Package,
  product_review: Star,
  dispute: ShieldAlert,
  dispute_update: ShieldAlert,
  safety: AlertTriangle,
  sos_alert: AlertTriangle,
  helper_request: ShieldAlert,
  message: MessageSquare,
  new_message: MessageSquare,
  event: Calendar,
  reward: Gift,
  achievement: Star,
};

export const getNotificationIcon = (type: string): LucideIcon =>
  NOTIFICATION_ICON_MAP[type] || Bell;

// ─── Color Mapping ──────────────────────────────────────────────────

export const NOTIFICATION_COLOR_MAP: Record<string, string> = {
  like: 'bg-rose-500/15 text-rose-500',
  comment: 'bg-sky-500/15 text-sky-500',
  follow: 'bg-emerald-500/15 text-emerald-500',
  new_post: 'bg-violet-500/15 text-violet-500',
  new_video: 'bg-fuchsia-500/15 text-fuchsia-500',
  story_mention: 'bg-amber-500/15 text-amber-500',
  mention: 'bg-amber-500/15 text-amber-500',
  live_start: 'bg-red-500/15 text-red-500',
  circle_member: 'bg-blue-500/15 text-blue-500',
  circle_post: 'bg-blue-500/15 text-blue-500',
  circle_event: 'bg-orange-500/15 text-orange-500',
  circle_invite: 'bg-blue-500/15 text-blue-500',
  question_answer: 'bg-teal-500/15 text-teal-500',
  answer_vote: 'bg-teal-500/15 text-teal-500',
  order: 'bg-purple-500/15 text-purple-500',
  order_update: 'bg-purple-500/15 text-purple-500',
  order_shipped: 'bg-indigo-500/15 text-indigo-500',
  order_delivered: 'bg-green-500/15 text-green-500',
  product_review: 'bg-yellow-500/15 text-yellow-500',
  dispute: 'bg-red-500/15 text-red-500',
  dispute_update: 'bg-red-500/15 text-red-500',
  safety: 'bg-red-600/20 text-red-600',
  sos_alert: 'bg-red-600/20 text-red-600',
  helper_request: 'bg-red-600/20 text-red-600',
  message: 'bg-sky-500/15 text-sky-500',
  new_message: 'bg-sky-500/15 text-sky-500',
  event: 'bg-orange-500/15 text-orange-500',
  reward: 'bg-yellow-500/15 text-yellow-500',
  achievement: 'bg-yellow-500/15 text-yellow-500',
};

export const getNotificationColor = (type: string): string =>
  NOTIFICATION_COLOR_MAP[type] || 'bg-muted text-muted-foreground';

// ─── Category Mapping ───────────────────────────────────────────────

const SOCIAL_TYPES = new Set([
  'like', 'comment', 'follow', 'new_post', 'new_video',
  'story_mention', 'mention', 'live_start',
]);

const CIRCLE_TYPES = new Set([
  'circle_member', 'circle_post', 'circle_event', 'circle_invite',
]);

const SHOP_TYPES = new Set([
  'order', 'order_update', 'order_shipped', 'order_delivered',
  'product_review', 'dispute', 'dispute_update',
]);

const SAFETY_TYPES = new Set([
  'safety', 'sos_alert', 'helper_request',
]);

const MESSAGE_TYPES = new Set(['message', 'new_message']);

export const getNotificationCategory = (type: string): NotifCategory => {
  if (SOCIAL_TYPES.has(type)) return 'social';
  if (CIRCLE_TYPES.has(type)) return 'circles';
  if (SHOP_TYPES.has(type)) return 'shop';
  if (SAFETY_TYPES.has(type)) return 'safety';
  if (MESSAGE_TYPES.has(type)) return 'messages';
  return 'other';
};

export const filterByCategory = (notifications: any[], category: string): any[] => {
  if (category === 'all') return notifications;
  if (category === 'unread') return notifications.filter(n => !n.read_at);
  return notifications.filter(n => getNotificationCategory(n.notification_type) === category);
};

// ─── Priority ───────────────────────────────────────────────────────

export const getNotificationPriority = (type: string): NotifPriority => {
  if (SAFETY_TYPES.has(type)) return 'critical';
  if (['mention', 'story_mention', 'live_start', 'order', 'order_shipped', 'new_message', 'circle_invite', 'dispute_update'].includes(type)) return 'high';
  if (['answer_vote', 'new_post', 'new_video', 'product_review'].includes(type)) return 'low';
  return 'normal';
};

// ─── Time Grouping ──────────────────────────────────────────────────

export const getTimeGroup = (dateStr: string): TimeGroup => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  return 'Earlier';
};

export const groupByTime = (notifications: any[]): Record<TimeGroup, any[]> => {
  const groups: Record<TimeGroup, any[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'Earlier': [],
  };

  for (const n of notifications) {
    const group = getTimeGroup(n.sent_at || n.created_at);
    groups[group].push(n);
  }

  return groups;
};

// ─── Smart Batching ─────────────────────────────────────────────────

/**
 * Groups similar notifications together.
 * e.g. 5 "like" notifications on the same postId → "Sarah, Alex and 3 others liked your post"
 */
export const batchNotifications = (
  notifications: any[],
  profileLookup?: (userId: string) => any
): Array<any | BatchedNotification> => {
  const batchable = new Set(['like', 'comment', 'follow']);
  const result: Array<any | BatchedNotification> = [];
  // Group by (type + targetId)
  const batchMap = new Map<string, any[]>();
  const nonBatchable: any[] = [];

  // Also batch messages by sender
  const messageMap = new Map<string, any[]>();

  for (const n of notifications) {
    const data = n.data || {};

    if (n.notification_type === 'message' || n.notification_type === 'new_message') {
      const senderId = data.userId || data.senderId || data.conversationId || 'unknown';
      if (!messageMap.has(senderId)) messageMap.set(senderId, []);
      messageMap.get(senderId)!.push(n);
    } else if (batchable.has(n.notification_type)) {
      const targetId = data.postId || data.videoId || 'general';
      const key = `${n.notification_type}:${targetId}`;
      if (!batchMap.has(key)) batchMap.set(key, []);
      batchMap.get(key)!.push(n);
    } else {
      nonBatchable.push(n);
    }
  }

  // Process batched social notifications
  for (const [, group] of batchMap) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    group.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    const latest = group[0];
    const type = latest.notification_type;
    const profiles = group
      .map(n => {
        const userId = (n.data as any)?.userId;
        return userId && profileLookup ? profileLookup(userId) : null;
      })
      .filter(Boolean)
      .slice(0, 3);

    const names = profiles.map(p => p?.name || 'Someone');
    const othersCount = group.length - names.length;
    const nameStr = names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]}, ${names[1]}${othersCount > 0 ? ` and ${othersCount} other${othersCount > 1 ? 's' : ''}` : ''}`;

    const actionMap: Record<string, string> = {
      like: 'liked your post',
      comment: 'commented on your post',
      follow: 'started following you',
    };

    const batched: BatchedNotification = {
      latest: { ...latest, _isBatched: true },
      ids: group.map(n => n.id),
      count: group.length,
      batchTitle: `${nameStr} ${actionMap[type] || 'interacted'}`,
      batchBody: group.length > 1 ? `${group.length} ${type}s total` : latest.body,
      profiles,
    };

    result.push(batched);
  }

  // Process message groups
  for (const [, group] of messageMap) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    group.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    const latest = { ...group[0] };
    latest.body = group.length > 1
      ? `Sent you ${group.length} new messages`
      : 'Sent you a new message';
    latest._groupItemIds = group.map(g => g.id);
    result.push(latest);
  }

  // Add non-batchable
  result.push(...nonBatchable);

  // Sort by time descending
  result.sort((a, b) => {
    const aTime = new Date((a.latest?.sent_at || a.sent_at) ?? 0).getTime();
    const bTime = new Date((b.latest?.sent_at || b.sent_at) ?? 0).getTime();
    return bTime - aTime;
  });

  return result;
};

// ─── Navigation Target ──────────────────────────────────────────────

export interface NavTarget {
  path: string;
  state?: Record<string, any>;
}

export const getNotificationNavTarget = (notification: any): NavTarget => {
  const data = notification.data || {};
  const type = notification.notification_type;

  switch (type) {
    case 'like':
    case 'comment':
    case 'new_post':
      if (data.type === 'video_comment' || data.type === 'video_like') {
        return { path: '/', state: { feedMode: 'relax', videoId: data.videoId, openComments: data.type === 'video_comment' } };
      }
      return data.postId ? { path: `/post/${data.postId}` } : { path: '/notifications' };

    case 'new_video':
      return data.videoId
        ? { path: '/', state: { feedMode: 'relax', videoId: data.videoId } }
        : { path: '/notifications' };

    case 'follow':
      return data.userId ? { path: `/profile/${data.userId}` } : { path: '/notifications' };

    case 'mention':
      if (data.postId) return { path: `/post/${data.postId}` };
      if (data.videoId) return { path: '/', state: { feedMode: 'relax', videoId: data.videoId } };
      return { path: '/notifications' };

    case 'story_mention':
      return { path: '/notifications' }; // handled by reshare dialog

    case 'circle_member':
    case 'circle_event':
    case 'circle_invite':
      return data.circleId ? { path: `/circles/${data.circleId}` } : { path: '/notifications' };

    case 'circle_post':
      if (data.postId && data.circleId) return { path: `/circles/${data.circleId}/post/${data.postId}` };
      return data.circleId ? { path: `/circles/${data.circleId}` } : { path: '/notifications' };

    case 'live_start':
      return data.streamId ? { path: `/live/${data.streamId}` } : { path: '/notifications' };

    case 'question_answer':
    case 'answer_vote':
      return data.questionId ? { path: `/ask/question/${data.questionId}` } : { path: '/notifications' };

    case 'order':
    case 'order_update':
    case 'order_shipped':
    case 'order_delivered':
      return data.orderId ? { path: `/order/${data.orderId}` } : { path: '/order-history' };

    case 'message':
    case 'new_message':
      return data.conversationId
        ? { path: '/messages', state: { conversationId: data.conversationId } }
        : { path: '/messages' };

    case 'safety':
    case 'sos_alert':
    case 'helper_request':
      return { path: '/', state: { activeTab: 'safe' } };

    case 'event':
      return data.circleId ? { path: `/circles/${data.circleId}` } : { path: '/notifications' };

    case 'reward':
    case 'achievement':
      return { path: '/profile' };

    case 'product_review':
      return data.productId ? { path: `/product/${data.productId}` } : { path: '/notifications' };

    case 'dispute':
    case 'dispute_update':
      return { path: '/disputes' };

    default:
      if (data.postId) return { path: `/post/${data.postId}` };
      if (data.videoId) return { path: '/', state: { feedMode: 'relax', videoId: data.videoId } };
      if (data.circleId) return { path: `/circles/${data.circleId}` };
      if (data.orderId) return { path: `/order/${data.orderId}` };
      if (data.conversationId) return { path: '/messages', state: { conversationId: data.conversationId } };
      if (data.questionId) return { path: `/ask/question/${data.questionId}` };
      if (data.userId) return { path: `/profile/${data.userId}` };
      return { path: '/notifications' };
  }
};

// ─── Relative Time ──────────────────────────────────────────────────

export const formatRelativeTime = (dateStr: string): string => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`;
  if (diffMs < 604800000) return `${Math.floor(diffMs / 86400000)}d`;
  return `${Math.floor(diffMs / 604800000)}w`;
};
