import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import {
  filterByCategory,
  batchNotifications,
  groupByTime,
  getNotificationNavTarget,
  TimeGroup,
} from '@/utils/notificationHelpers';
import NotificationItem from './NotificationItem';
import NotificationGroupItem from './NotificationGroupItem';
import NotificationSettingsModal from './NotificationSettingsModal';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Button } from '@/components/ui/button';
import {
  Bell, CheckCheck, Settings, ArrowRight, X,
  Inbox, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'social', label: 'Social' },
  { id: 'circles', label: 'Circles' },
  { id: 'shop', label: 'Shop' },
  { id: 'safety', label: 'Safety' },
  { id: 'messages', label: 'Messages' },
];

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showSettings, setShowSettings] = useState(false);

  const {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  // Fetch profiles for sender avatars
  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    notifications.forEach((n) => {
      const uid = (n.data as any)?.userId || (n.data as any)?.senderId;
      if (uid) ids.add(uid);
    });
    return Array.from(ids);
  }, [notifications]);

  const { data: profiles } = useQuery({
    queryKey: ['notification-panel-profiles', profileIds.join(',')],
    queryFn: async () => {
      if (profileIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, initials, avatar_color')
        .in('id', profileIds);
      return data || [];
    },
    staleTime: 60000,
    enabled: profileIds.length > 0 && isOpen,
  });

  const getProfile = (userId: string) => profiles?.find((p) => p.id === userId);

  // Filter & Batch
  const filteredNotifications = useMemo(() => {
    const categoryFiltered = filterByCategory(notifications, selectedCategory);
    return batchNotifications(categoryFiltered, getProfile);
  }, [notifications, selectedCategory, profiles]);

  // Group by Time
  const timeGroups = useMemo(() => {
    return groupByTime(filteredNotifications);
  }, [filteredNotifications]);

  const handleItemClick = (item: any) => {
    const notification = item._isBatched ? item.latest : item;
    if (!notification.read_at) {
      if (item._groupItemIds) {
        item._groupItemIds.forEach((id: string) => markAsRead.mutate(id));
      } else if (item.ids) {
        item.ids.forEach((id: string) => markAsRead.mutate(id));
      } else {
        markAsRead.mutate(notification.id);
      }
    }

    const target = getNotificationNavTarget(notification);
    onClose();
    if (target.state) {
      navigate(target.path, { state: target.state });
    } else {
      navigate(target.path);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead.mutate(undefined, {
      onSuccess: () => toast.success('All marked as read'),
    });
  };

  const handleSeeAll = () => {
    onClose();
    navigate('/notifications');
  };

  if (!isOpen) return null;

  const groupKeys: TimeGroup[] = ['Today', 'Yesterday', 'This Week', 'Earlier'];
  const hasAnyItems = filteredNotifications.length > 0;

  return (
    <>
      {/* Semi-transparent backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 sm:hidden transition-opacity"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="fixed sm:absolute top-12 left-2 right-2 sm:left-auto sm:right-0 z-50 sm:w-[420px] max-h-[85vh] sm:max-h-[640px] flex flex-col rounded-2xl border border-border/80 bg-background/95 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-3.5 pb-2 border-b border-border/50 bg-background/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Bell className="size-4 text-primary" />
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  title="Mark all as read"
                >
                  <CheckCheck className="size-3.5 mr-1 text-primary" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
                title="Notification Settings"
              >
                <Settings className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Quick Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`
                    whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium transition-all
                    ${isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                  `}
                >
                  {cat.label}
                  {cat.id === 'unread' && unreadCount > 0 && (
                    <span className={`ml-1 text-[10px] ${isActive ? 'text-primary-foreground' : 'text-primary'}`}>
                      ({unreadCount})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {isLoading && notifications.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <SerkleLoader size="sm" />
              <p className="text-xs text-muted-foreground">Loading notifications...</p>
            </div>
          ) : !hasAnyItems ? (
            <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
                <Inbox className="size-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                {selectedCategory === 'unread'
                  ? "You're all caught up! No unread messages or updates."
                  : 'Activity like mentions, reactions, and orders will show up here.'}
              </p>
            </div>
          ) : (
            groupKeys.map((group) => {
              const items = timeGroups[group] || [];
              if (items.length === 0) return null;

              return (
                <div key={group} className="py-1">
                  <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 bg-muted/20">
                    {group}
                  </div>
                  <div className="divide-y divide-border/30">
                    {items.slice(0, 15).map((item: any) => {
                      if (item._isBatched) {
                        return (
                          <NotificationGroupItem
                            key={item.latest.id}
                            batch={item}
                            compact
                            onClickItem={handleItemClick}
                          />
                        );
                      }

                      const profile = (item.data as any)?.userId
                        ? getProfile((item.data as any).userId)
                        : null;

                      return (
                        <NotificationItem
                          key={item.id}
                          notification={item}
                          profile={profile}
                          compact
                          onClickItem={handleItemClick}
                          onMarkRead={(id) => markAsRead.mutate(id)}
                          onDelete={(id) => deleteNotification.mutate(id)}
                          onNavigateProfile={(uid) => {
                            onClose();
                            navigate(`/profile/${uid}`);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-border/50 bg-muted/15 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSeeAll}
            className="w-full h-8 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 flex items-center justify-center gap-1.5 rounded-xl"
          >
            <span>View all notifications</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Settings Modal */}
      <NotificationSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </>
  );
};

export default NotificationPanel;
