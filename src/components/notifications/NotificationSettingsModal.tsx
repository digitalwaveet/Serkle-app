import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Bell, Volume2, ShieldAlert, Heart, Users,
  ShoppingBag, MessageSquare, Moon, Sparkles, Check
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { SerkleLoader } from '@/components/ui/SerkleLoader';

interface NotificationSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { user } = useUser();
  const { preferences, isLoading, updatePreferences } = useNotificationPreferences(user?.id);

  const handleToggle = (key: string, value: boolean) => {
    updatePreferences.mutate({ [key]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0 rounded-2xl gap-0 border-border bg-background shadow-2xl">
        <DialogHeader className="p-5 pb-3 sticky top-0 bg-background/95 backdrop-blur-md z-10 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Bell className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Notification Preferences</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Customize which alerts and updates you receive
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading || !preferences ? (
          <div className="flex items-center justify-center p-12">
            <SerkleLoader size="sm" />
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-4 text-primary" />
                  Allow Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Master switch for in-app and push notifications
                </p>
              </div>
              <Switch
                checked={preferences.enabled}
                onCheckedChange={(val) => handleToggle('enabled', val)}
              />
            </div>

            {/* Sound & In-App Alerts */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Volume2 className="size-3.5" />
                Sounds & Alerts
              </h3>
              <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden bg-card/40">
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Sound Effects</Label>
                    <p className="text-[11px] text-muted-foreground">Play a soft chime on new activity</p>
                  </div>
                  <Switch
                    checked={preferences.sound_enabled ?? true}
                    onCheckedChange={(val) => handleToggle('sound_enabled', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">In-App Banners</Label>
                    <p className="text-[11px] text-muted-foreground">Show popup banner when app is open</p>
                  </div>
                  <Switch
                    checked={preferences.in_app_toasts ?? true}
                    onCheckedChange={(val) => handleToggle('in_app_toasts', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
              </div>
            </div>

            {/* Social Activity */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Heart className="size-3.5 text-rose-500" />
                Social Activity
              </h3>
              <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden bg-card/40">
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Likes & Reactions</Label>
                    <p className="text-[11px] text-muted-foreground">When someone likes your post or video</p>
                  </div>
                  <Switch
                    checked={preferences.social_likes ?? true}
                    onCheckedChange={(val) => handleToggle('social_likes', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Comments & Replies</Label>
                    <p className="text-[11px] text-muted-foreground">When someone comments on your post</p>
                  </div>
                  <Switch
                    checked={preferences.social_comments ?? true}
                    onCheckedChange={(val) => handleToggle('social_comments', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">New Followers</Label>
                    <p className="text-[11px] text-muted-foreground">When someone starts following you</p>
                  </div>
                  <Switch
                    checked={preferences.social_follows ?? true}
                    onCheckedChange={(val) => handleToggle('social_follows', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Mentions & Tags</Label>
                    <p className="text-[11px] text-muted-foreground">When someone tags you in a post or story</p>
                  </div>
                  <Switch
                    checked={preferences.social_mentions ?? true}
                    onCheckedChange={(val) => handleToggle('social_mentions', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
              </div>
            </div>

            {/* Circles */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="size-3.5 text-blue-500" />
                Circles & Communities
              </h3>
              <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden bg-card/40">
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Circle Posts</Label>
                    <p className="text-[11px] text-muted-foreground">New posts in circles you have joined</p>
                  </div>
                  <Switch
                    checked={preferences.circles_posts ?? true}
                    onCheckedChange={(val) => handleToggle('circles_posts', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Circle Events</Label>
                    <p className="text-[11px] text-muted-foreground">Upcoming events and calendar updates</p>
                  </div>
                  <Switch
                    checked={preferences.circles_events ?? true}
                    onCheckedChange={(val) => handleToggle('circles_events', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
              </div>
            </div>

            {/* Shop & Orders */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShoppingBag className="size-3.5 text-purple-500" />
                Shop & Orders
              </h3>
              <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden bg-card/40">
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Order Updates & Shipping</Label>
                    <p className="text-[11px] text-muted-foreground">Order confirmations, tracking & delivery</p>
                  </div>
                  <Switch
                    checked={preferences.shop_orders ?? true}
                    onCheckedChange={(val) => handleToggle('shop_orders', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Disputes & Resolution</Label>
                    <p className="text-[11px] text-muted-foreground">Important updates regarding order disputes</p>
                  </div>
                  <Switch
                    checked={preferences.shop_disputes ?? true}
                    onCheckedChange={(val) => handleToggle('shop_disputes', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
              </div>
            </div>

            {/* Direct Messages */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-sky-500" />
                Direct & Group Messages
              </h3>
              <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden bg-card/40">
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Direct Messages</Label>
                    <p className="text-[11px] text-muted-foreground">When someone sends you a private chat</p>
                  </div>
                  <Switch
                    checked={preferences.messages_direct ?? true}
                    onCheckedChange={(val) => handleToggle('messages_direct', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Group Chats</Label>
                    <p className="text-[11px] text-muted-foreground">Messages in group conversations</p>
                  </div>
                  <Switch
                    checked={preferences.messages_groups ?? true}
                    onCheckedChange={(val) => handleToggle('messages_groups', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
              </div>
            </div>

            {/* Safety & SOS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5" />
                  Emergency & Safe Mode
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                  Always Active
                </span>
              </div>
              <div className="rounded-xl border border-red-500/20 divide-y divide-red-500/10 overflow-hidden bg-red-500/[0.02]">
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">SOS Community Alerts</Label>
                    <p className="text-[11px] text-muted-foreground">Critical distress broadcasts near you</p>
                  </div>
                  <Switch
                    checked={preferences.sos_alerts ?? true}
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Helper Responses</Label>
                    <p className="text-[11px] text-muted-foreground">When nearby members respond to safety calls</p>
                  </div>
                  <Switch
                    checked={preferences.helper_responses ?? true}
                    onCheckedChange={(val) => handleToggle('helper_responses', val)}
                    disabled={!preferences.enabled}
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-center text-muted-foreground pt-2">
              Changes are saved automatically to your device and account.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsModal;
