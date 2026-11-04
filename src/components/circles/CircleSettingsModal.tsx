import { refreshCircleMembership } from '@/lib/circleMembershipClient';
import React, { useState, useEffect } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, Coins, Crown, Lock, Users, Trash2, AlertTriangle, Link2, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { type Circle } from '@/hooks/useCircles';
import { formatCircleCount } from '@/lib/circleCountFormat';

interface CircleSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circle: Circle;
}

const CircleSettingsModal: React.FC<CircleSettingsModalProps> = ({ open, onOpenChange, circle }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [subscriptionEnabled, setSubscriptionEnabled] = useState(circle.subscription_enabled ?? false);
  const [subscriptionPrice, setSubscriptionPrice] = useState(circle.subscription_price ?? 10);
  const [subscriptionMethod, setSubscriptionMethod] = useState(circle.subscription_method ?? 'after_join');
  const [isPrivate, setIsPrivate] = useState(circle.is_private ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const publishedDomain = 'https://heart-lens-studio.lovable.app';
  const inviteLink = circle.invite_code ? `${publishedDomain}/join/${circle.invite_code}` : '';

  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      toast({ title: 'Invite link copied!' });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (open) {
      setSubscriptionEnabled(circle.subscription_enabled ?? false);
      setSubscriptionPrice(circle.subscription_price ?? 10);
      setSubscriptionMethod(circle.subscription_method ?? 'after_join');
      setIsPrivate(circle.is_private ?? false);
      fetchSubscribers();
    }
  }, [open, circle]);

  const fetchSubscribers = async () => {
    setLoadingSubscribers(true);
    try {
      const { data, error } = await supabase
        .from('circle_subscriptions')
        .select(`
          id,
          user_id,
          status,
          created_at,
          profiles:user_id (name, username, avatar_url, initials, avatar_color)
        `)
        .eq('circle_id', circle.id)
        .eq('status', 'active');

      if (error) throw error;
      setSubscribers(data || []);
    } catch (err) {
      console.error('Error fetching subscribers:', err);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('circles')
        .update({
          subscription_enabled: subscriptionEnabled,
          subscription_price: subscriptionPrice,
          subscription_method: subscriptionMethod,
          // Premium Circle status follows the subscription model — it is not a
          // separate badge and never implies verification
          is_premium: subscriptionEnabled,
          is_private: isPrivate,
        })
        .eq('id', circle.id)
        .eq('creator_id', circle.creator_id);

      if (error) throw error;

      await refreshCircleMembership(queryClient);
      toast({ title: 'Settings saved' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Failed to save settings', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCircle = async () => {
    try {
      const { error } = await supabase
        .from('circles')
        .delete()
        .eq('id', circle.id)
        .eq('creator_id', circle.creator_id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['circles'] });
      queryClient.invalidateQueries({ queryKey: ['my-circles'] });
      queryClient.invalidateQueries({ queryKey: ['owned-circles'] });
      toast({ title: 'Circle deleted' });
      onOpenChange(false);
      window.location.href = '/';
    } catch (err: any) {
      toast({ title: 'Failed to delete circle', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Circle Settings
          </DialogTitle>
          <DialogDescription>
            Manage monetization, privacy, and circle preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Invite Link Section */}
          {inviteLink && (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  Invite Link
                </h3>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="text-xs font-mono bg-muted"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button size="icon" variant="outline" onClick={handleCopyInviteLink} className="shrink-0">
                    {linkCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Share this link to invite people to your circle</p>
              </div>
              <Separator />
            </>
          )}

          {/* Monetization Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Crown className="w-4 h-4 text-secondary" />
              Premium Circle
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Make this a Premium Circle</Label>
                <p className="text-xs text-muted-foreground">Charge a subscription for access to Premium content</p>
              </div>
              <Switch checked={subscriptionEnabled} onCheckedChange={setSubscriptionEnabled} />
            </div>

            {subscriptionEnabled && (
              <div className="pl-4 border-l-2 border-primary/20 space-y-4">
                <div>
                  <Label htmlFor="sub-price" className="text-sm">Subscription Price (coins)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    <Input
                      id="sub-price"
                      type="number"
                      min={1}
                      max={10000}
                      value={subscriptionPrice}
                      onChange={(e) => setSubscriptionPrice(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">coins</span>
                  </div>
                </div>

                {/* Subscription Method */}
                <div>
                  <Label className="text-sm font-medium">Subscription Method</Label>
                  <p className="text-xs text-muted-foreground mb-2">When should users pay?</p>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${subscriptionMethod === 'before_join' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <input
                        type="radio"
                        name="sub-method"
                        value="before_join"
                        checked={subscriptionMethod === 'before_join'}
                        onChange={() => setSubscriptionMethod('before_join')}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium">Subscribe to join</p>
                        <p className="text-xs text-muted-foreground">Members must subscribe before joining the Circle</p>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${subscriptionMethod === 'after_join' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <input
                        type="radio"
                        name="sub-method"
                        value="after_join"
                        checked={subscriptionMethod === 'after_join'}
                        onChange={() => setSubscriptionMethod('after_join')}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium">Join free, subscribe for Premium</p>
                        <p className="text-xs text-muted-foreground">Members join for free and subscribe later for Premium content</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Privacy */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Privacy
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Private Circle</Label>
                <p className="text-xs text-muted-foreground">Only approved members can join</p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>
          </div>

          <Separator />

          {/* Subscribers */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Active: {formatCircleCount(subscribers.length, 'subscriber')}
            </h3>

            {loadingSubscribers ? (
              <SerkleLoader size="sm" label="Loading subscribers" showText />
            ) : subscribers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active subscribers yet</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {subscribers.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 py-1.5">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={sub.profiles?.avatar_url} />
                      <AvatarFallback style={{ backgroundColor: sub.profiles?.avatar_color }}>
                        {sub.profiles?.initials || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sub.profiles?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">@{sub.profiles?.username || 'unknown'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Danger Zone */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h3>

            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Circle
              </Button>
            ) : (
              <div className="space-y-2 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                <p className="text-sm text-destructive font-medium">Are you sure? This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1" onClick={handleDeleteCircle}>
                    Confirm Delete
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CircleSettingsModal;
