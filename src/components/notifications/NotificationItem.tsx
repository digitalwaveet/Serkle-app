import React, { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Check, Trash2, ExternalLink } from 'lucide-react';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import {
  getNotificationIcon,
  getNotificationColor,
  formatRelativeTime,
} from '@/utils/notificationHelpers';

interface NotificationItemProps {
  notification: any;
  profile?: any;
  compact?: boolean;
  onClickItem: (n: any) => void;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onNavigateProfile?: (userId: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  profile,
  compact = false,
  onClickItem,
  onMarkRead,
  onDelete,
  onNavigateProfile,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const Icon = getNotificationIcon(notification.notification_type);
  const colorClass = getNotificationColor(notification.notification_type);
  const isUnread = !notification.read_at;
  const isSafety = ['safety', 'sos_alert', 'helper_request'].includes(notification.notification_type);

  const swipeHandlers = useSwipeGestures(
    {
      onSwipeLeft: () => {
        if (onDelete) {
          setIsDeleting(true);
          setTimeout(() => onDelete(notification.id), 300);
        }
      },
      onSwipeRight: () => {
        if (isUnread && onMarkRead) {
          onMarkRead(notification.id);
        }
      },
    },
    { threshold: 100 }
  );

  const avatarSize = compact ? 'size-9' : 'size-10 sm:size-11';
  const microIconSize = compact ? 'size-4' : 'size-4.5';
  const microIconInner = compact ? 'size-2' : 'size-2.5';

  return (
    <div
      {...swipeHandlers}
      className={`
        group relative transition-all duration-300 ease-out cursor-pointer overflow-hidden
        ${compact ? 'px-3 py-2.5' : 'px-4 py-3 sm:py-3.5'}
        ${isSafety && isUnread
          ? 'bg-red-500/[0.06] hover:bg-red-500/[0.10] border-l-[3px] border-l-red-500'
          : isUnread
            ? 'bg-primary/[0.03] hover:bg-primary/[0.06]'
            : 'bg-transparent hover:bg-muted/40'
        }
        ${isDeleting ? 'opacity-0 scale-95 -translate-x-full' : 'opacity-100 scale-100 translate-x-0'}
      `}
      onClick={() => onClickItem(notification)}
    >
      {/* Unread indicator (left edge glow) — only for non-safety */}
      {isUnread && !isSafety && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/80 rounded-r-md shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
      )}

      <div className="flex items-start gap-3">
        {/* Avatar / Icon */}
        <div className="relative flex-shrink-0 mt-0.5">
          {profile ? (
            <Avatar
              className={`${avatarSize} ring-2 ring-background/50 shadow-sm transition-transform duration-200 group-hover:scale-105 cursor-pointer`}
              onClick={(e) => {
                e.stopPropagation();
                onNavigateProfile?.(profile.id);
              }}
            >
              <AvatarImage src={profile.avatar_url} className="object-cover" />
              <AvatarFallback
                className="text-xs font-semibold"
                style={{ backgroundColor: profile.avatar_color, color: '#fff' }}
              >
                {profile.initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className={`${avatarSize} rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shadow-sm ${colorClass}`}>
              <Icon className="size-4.5" />
            </div>
          )}

          {/* Micro icon overlay on avatar */}
          {profile && (
            <div className={`absolute -bottom-1 -right-1 ${microIconSize} rounded-full flex items-center justify-center border-[1.5px] border-background shadow-sm ${colorClass}`}>
              <Icon className={microIconInner} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`font-medium text-foreground truncate ${compact ? 'text-[13px]' : 'text-sm'}`}>
              {notification.title}
            </p>
            <span className="text-[10px] font-medium text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
              {formatRelativeTime(notification.sent_at || notification.created_at)}
            </span>
          </div>

          <p className={`text-muted-foreground line-clamp-1 leading-snug ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {notification.body}
          </p>

          {/* Safety badge */}
          {isSafety && isUnread && (
            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 text-[10px] font-semibold">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
              Urgent
            </span>
          )}
        </div>

        {/* Hover actions (desktop) */}
        {(onMarkRead || onDelete) && (
          <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 self-center ml-1">
            {isUnread && onMarkRead && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
                className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary text-muted-foreground"
                title="Mark as read"
              >
                <Check className="size-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleting(true);
                  setTimeout(() => onDelete(notification.id), 300);
                }}
                className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                title="Delete"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* Unread dot (mobile only, no hover actions) */}
        {isUnread && (
          <div className="md:hidden flex items-center self-center ml-1">
            <div className="size-2 rounded-full bg-primary shadow-sm" />
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationItem;
