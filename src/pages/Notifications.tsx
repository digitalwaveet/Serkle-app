import React, { useState, useMemo, useEffect } from 'react';
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
import NotificationItem from '@/components/notifications/NotificationItem';
import NotificationGroupItem from '@/components/notifications/NotificationGroupItem';
import NotificationSettingsModal from '@/components/notifications/NotificationSettingsModal';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import FooterNav from '@/components/FooterNav';
import GenericEmptyState from '@/components/ui/empty-state';
import {
  ArrowLeft, CheckCheck, Trash2, Settings,
  Sparkles, Bell
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'social', label: 'Social' },
  { id: 'circles', label: 'Circles' },
  { id: 'shop', label: 'Shop' },
  { id: 'safety', label: 'Safety' },
  { id: 'messages', label: 'Messages' },
];

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [reshareDialog, setReshareDialog] = useState<{ storyId: string; mentionerName: string } | null>(null);
  const [isResharing, setIsResharing] = useState(false);

  const {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  // Referenced profiles for avatars
  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    notifications.forEach((n) => {
      const uid = (n.data as any)?.userId || (n.data as any)?.senderId;
      if (uid) ids.add(uid);
    });
    return Array.from(ids);
  }, [notifications]);

  const { data: profiles } = useQuery({
    queryKey: ['notifications-page-profiles', profileIds.join(',')],
    queryFn: async () => {
      if (profileIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, initials, avatar_color')
        .in('id', profileIds);
      return data || [];
    },
    staleTime: 60000,
    enabled: profileIds.length > 0,
  });

  const getProfile = (userId: string) => profiles?.find((p) => p.id === userId);

  // Realtime notification for mentions
  useEffect(() => {
    const channel = supabase
      .channel('notifications-page-mentions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'push_notifications' },
        (payload) => {
          const n = payload.new as any;
          if (n && (n.notification_type === 'mention' || n.notification_type === 'story_mention')) {
            toast('📢 Someone mentioned you!', { duration: 4000 });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter and Batch notifications
  const filteredNotifications = useMemo(() => {
    const categoryFiltered = filterByCategory(notifications, activeCategory);
    return batchNotifications(categoryFiltered, getProfile);
  }, [notifications, activeCategory, profiles]);

  // Group by Time
  const timeGroups = useMemo(() => {
    return groupByTime(filteredNotifications);
  }, [filteredNotifications]);

  const handleItemClick = (item: any) => {
    const notification = item._isBatched ? item.latest : item;
    const data = notification.data || {};

    if (!notification.read_at) {
      if (item._groupItemIds) {
        item._groupItemIds.forEach((id: string) => markAsRead.mutate(id));
      } else if (item.ids) {
        item.ids.forEach((id: string) => markAsRead.mutate(id));
      } else {
        markAsRead.mutate(notification.id);
      }
    }

    if (notification.notification_type === 'story_mention' && data.story_id) {
      const mentionerProfile = data.mentioner_id ? getProfile(data.mentioner_id) : null;
      setReshareDialog({
        storyId: data.story_id,
        mentionerName: mentionerProfile?.name || notification.title?.split(' mentioned')[0] || 'Someone',
      });
      return;
    }

    const target = getNotificationNavTarget(notification);
    if (target.state) {
      navigate(target.path, { state: target.state });
    } else {
      navigate(target.path);
    }
  };

  const handleReshareConfirm = async () => {
    if (!reshareDialog) return;
    setIsResharing(true);
    try {
      const { data: story } = await supabase
        .from('stories')
        .select('media_url, media_type')
        .eq('id', reshareDialog.storyId)
        .single();
      if (!story) throw new Error('Story not found');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: story.media_url,
        media_type: story.media_type,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        reshared_story_id: reshareDialog.storyId,
      } as any);

      if (error) throw error;
      toast.success('Story reshared to your profile!');
    } catch {
      toast.error('Failed to reshare story');
    } finally {
      setIsResharing(false);
      setReshareDialog(null);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead.mutate(undefined, {
      onSuccess: () => toast.success('All marked as read'),
    });
  };

  const handleClearAll = () => {
    clearAllNotifications.mutate(undefined, {
      onSuccess: () => {
        toast.success('All notifications cleared');
        setConfirmClearAll(false);
      },
    });
  };

  if (isLoading && notifications.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SerkleLoader size="md" className="text-current" />
      </div>
    );
  }

  const groupKeys: TimeGroup[] = ['Today', 'Yesterday', 'This Week', 'Earlier'];
  const hasAnyItems = filteredNotifications.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-secondary/40 max-w-[480px] mx-auto border-l border-r border-border font-sans relative">
      {/* Header */}
      <div className="sticky top-0 bg-background/85 backdrop-blur-xl border-b border-border z-20">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="h-8 w-8 rounded-full"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-foreground">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="h-8 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-full"
              >
                <CheckCheck className="size-3.5 mr-1" />
                Read all
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettingsModal(true)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
              title="Notification Settings"
            >
              <Settings className="size-4" />
            </Button>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmClearAll(true)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-full"
                title="Clear all"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`
                  whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                {cat.label}
                {cat.id === 'unread' && unreadCount > 0 && (
                  <span className={`ml-1.5 text-[10px] ${isActive ? 'text-primary-foreground font-bold' : 'text-primary font-bold'}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notification List */}
      {!hasAnyItems ? (
        <GenericEmptyState
          title={
            activeCategory === 'unread'
              ? 'All caught up!'
              : activeCategory === 'social'
              ? 'No social updates'
              : activeCategory === 'circles'
              ? 'No circle activity'
              : activeCategory === 'shop'
              ? 'No shop notifications'
              : activeCategory === 'safety'
              ? 'No safety alerts'
              : activeCategory === 'messages'
              ? 'No chat alerts'
              : 'No notifications yet'
          }
          description={
            activeCategory === 'unread'
              ? "You've read all your notifications. We'll alert you when there is new activity!"
              : 'Interactions, mentions, updates, and orders will show up here.'
          }
          className="py-24"
        />
      ) : (
        <div className="divide-y divide-border/30">
          {groupKeys.map((group) => {
            const items = timeGroups[group] || [];
            if (items.length === 0) return null;

            return (
              <div key={group} className="pt-2">
                <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75 bg-muted/20">
                  {group}
                </div>
                <div className="divide-y divide-border/30">
                  {items.map((item: any) => {
                    if (item._isBatched) {
                      return (
                        <NotificationGroupItem
                          key={item.latest.id}
                          batch={item}
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
                        onClickItem={handleItemClick}
                        onMarkRead={(id) => markAsRead.mutate(id)}
                        onDelete={(id) => deleteNotification.mutate(id)}
                        onNavigateProfile={(uid) => navigate(`/profile/${uid}`)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Swipe hint */}
      {hasAnyItems && (
        <div className="px-4 py-3 text-center">
          <p className="text-[10px] text-muted-foreground">
            ← Swipe left to delete • Swipe right to mark as read →
          </p>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all notifications from your list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Story Reshare Dialog */}
      <AlertDialog open={!!reshareDialog} onOpenChange={(open) => !open && setReshareDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reshare to your story?</AlertDialogTitle>
            <AlertDialogDescription>
              {reshareDialog?.mentionerName} mentioned you in their story. Would you like to reshare it to your own story?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResharing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReshareConfirm} disabled={isResharing}>
              {isResharing ? 'Resharing...' : 'Reshare'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Modal */}
      <NotificationSettingsModal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
      />

      <FooterNav active="home" onSelect={() => {}} onOpenCreate={() => {}} />
    </div>
  );
};

export default Notifications;
