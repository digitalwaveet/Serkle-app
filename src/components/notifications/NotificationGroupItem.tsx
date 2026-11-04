import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  getNotificationIcon,
  getNotificationColor,
  formatRelativeTime,
  type BatchedNotification,
} from '@/utils/notificationHelpers';

interface NotificationGroupItemProps {
  batch: BatchedNotification;
  compact?: boolean;
  onClickItem: (n: any) => void;
}

const NotificationGroupItem: React.FC<NotificationGroupItemProps> = ({
  batch,
  compact = false,
  onClickItem,
}) => {
  const { latest, profiles, count, batchTitle, batchBody } = batch;
  const Icon = getNotificationIcon(latest.notification_type);
  const colorClass = getNotificationColor(latest.notification_type);
  const isUnread = !latest.read_at;

  return (
    <div
      className={`
        group relative transition-all duration-200 ease-out cursor-pointer
        ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}
        ${isUnread
          ? 'bg-primary/[0.03] hover:bg-primary/[0.06]'
          : 'bg-transparent hover:bg-muted/40'
        }
      `}
      onClick={() => onClickItem(latest)}
    >
      {isUnread && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/80 rounded-r-md" />
      )}

      <div className="flex items-start gap-3">
        {/* Stacked Avatars */}
        <div className="relative flex-shrink-0 mt-0.5">
          <div className={`relative ${compact ? 'w-9 h-9' : 'w-10 h-10 sm:w-11 sm:h-11'}`}>
            {profiles.length >= 3 && (
              <Avatar
                className={`absolute top-0 right-0 ${compact ? 'size-5' : 'size-6'} ring-2 ring-background shadow-sm z-[1]`}
              >
                <AvatarImage src={profiles[2]?.avatar_url} className="object-cover" />
                <AvatarFallback
                  className="text-[8px] font-semibold"
                  style={{ backgroundColor: profiles[2]?.avatar_color, color: '#fff' }}
                >
                  {profiles[2]?.initials || '?'}
                </AvatarFallback>
              </Avatar>
            )}
            {profiles.length >= 2 && (
              <Avatar
                className={`absolute top-1 ${compact ? 'left-1 size-5' : 'left-1.5 size-6'} ring-2 ring-background shadow-sm z-[2]`}
              >
                <AvatarImage src={profiles[1]?.avatar_url} className="object-cover" />
                <AvatarFallback
                  className="text-[8px] font-semibold"
                  style={{ backgroundColor: profiles[1]?.avatar_color, color: '#fff' }}
                >
                  {profiles[1]?.initials || '?'}
                </AvatarFallback>
              </Avatar>
            )}
            {profiles.length >= 1 ? (
              <Avatar
                className={`absolute bottom-0 left-0 ${compact ? 'size-6' : 'size-7'} ring-2 ring-background shadow-sm z-[3]`}
              >
                <AvatarImage src={profiles[0]?.avatar_url} className="object-cover" />
                <AvatarFallback
                  className="text-[9px] font-semibold"
                  style={{ backgroundColor: profiles[0]?.avatar_color, color: '#fff' }}
                >
                  {profiles[0]?.initials || '?'}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className={`${compact ? 'size-9' : 'size-10 sm:size-11'} rounded-full flex items-center justify-center shadow-sm ${colorClass}`}>
                <Icon className="size-4.5" />
              </div>
            )}

            {/* Batch count badge */}
            {count > 3 && (
              <div className="absolute -bottom-0.5 -right-0.5 z-[4] size-5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background shadow-sm">
                +{count - 3}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`font-medium text-foreground truncate ${compact ? 'text-[13px]' : 'text-sm'}`}>
              {batchTitle}
            </p>
            <span className="text-[10px] font-medium text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
              {formatRelativeTime(latest.sent_at || latest.created_at)}
            </span>
          </div>
          <p className={`text-muted-foreground line-clamp-1 leading-snug ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {batchBody}
          </p>
        </div>

        {/* Unread dot */}
        {isUnread && (
          <div className="flex items-center self-center ml-1">
            <div className="size-2 rounded-full bg-primary shadow-sm" />
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationGroupItem;
