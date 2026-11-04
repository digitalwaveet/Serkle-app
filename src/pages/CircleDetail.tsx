import { LeaveCircleDialog } from '@/components/circles/LeaveCircleDialog';
import CircleManageModal from '@/components/circles/CircleManageModal';
import { CircleMembershipButton } from '@/components/circles/CircleMembershipButton';
import { circleMembershipAction } from '@/lib/circleMembershipState';
import { refreshCircleMembership } from '@/lib/circleMembershipClient';
import { circleLoginPath } from '@/lib/authReturnPath';
import React, { useState, useEffect, useRef } from 'react';
import PublicProfileModal from '@/components/PublicProfileModal';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, Bell, MoreVertical, BadgeCheck, Pencil, Settings, Crown, Mail, ChevronDown, Share2, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import FooterNav from '@/components/FooterNav';
import CirclePosts from '@/components/circles/CirclePosts';
import CircleServices from '@/components/circles/CircleServices';
import CircleEvents from '@/components/circles/CircleEvents';
import CircleLearn from '@/components/circles/CircleLearn';
import CircleMembers from '@/components/circles/CircleMembers';
import CircleAbout from '@/components/circles/CircleAbout';
import CircleMessages from '@/components/circles/CircleMessages';
import CircleActivityStrip from '@/components/circles/CircleActivityStrip';
import CircleGettingStarted from '@/components/circles/CircleGettingStarted';
import EditCircleModal from '@/components/circles/EditCircleModal';
import CircleSettingsModal from '@/components/circles/CircleSettingsModal';
import { useCircle } from '@/hooks/useCircles';
import { useCircleMutations } from '@/hooks/useCircleMutations';
import { getCircleNav, getCircleType, displayCategory, CIRCLE_NAV_LABELS, LEGACY_TAB_MAP } from '@/lib/circleTypes';
import { useCircleSubscription } from '@/hooks/useCircleSubscription';
import { SubscribeCircleModal } from '@/components/circles/SubscribeCircleModal';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { type TabKey } from '@/hooks/useAppNav';
import { useQueryClient } from '@tanstack/react-query';
import { shareCircle } from '@/utils/shareUtils';
import { formatCircleCount } from '@/lib/circleCountFormat';

interface CircleDetailProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  onTabSelect: (tab: TabKey) => void;
  onOpenCreate: () => void;
}

const CircleDetail: React.FC<CircleDetailProps> = ({
  activeTab,
  setActiveTab,
  onTabSelect,
  onOpenCreate
}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [circleActiveTab, setCircleActiveTab] = useState(searchParams.get('tab') ?? '');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [ownershipOptionsOpen, setOwnershipOptionsOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const [showMiniHeader, setShowMiniHeader] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Explicit tab choices are reflected in the URL so circle sections can be
  // shared and survive back/forward navigation
  const selectTab = (tab: string) => {
    setCircleActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const { data: circle, isLoading, isError, refetch } = useCircle(id!, user?.id);
  const { joinCircle, leaveCircle, isJoining, isLeaving } = useCircleMutations();
  const { data: subscription } = useCircleSubscription(id);
  const hasSubscription = !!subscription;

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['circle', id] });
  };

  // Load persisted notification preferences
  useEffect(() => {
    const loadNotifPref = async () => {
      if (!user || !id || circle?.is_owned) return;
      const { data } = await supabase
        .from('circle_notification_preferences')
        .select('enabled')
        .eq('circle_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setNotificationsEnabled(data.enabled);
    };
    loadNotifPref();
  }, [user, id, circle?.is_owned]);

  const toggleNotifications = async () => {
    if (!user || !id) return;
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    await supabase
      .from('circle_notification_preferences')
      .upsert({ circle_id: id, user_id: user.id, enabled: newVal }, { onConflict: 'circle_id,user_id' });
    toast.success(newVal ? 'Notifications enabled' : 'Notifications disabled');
  };

  const handleJoinCircle = async () => {
    if (!user) {
      navigate(circleLoginPath(`/circle/${id}`));
      return;
    }
    if (!circle) return;

    // If subscription is required before joining, show subscribe modal
    if (circle.membership_state?.state === 'subscription_required') {
      setSubscribeModalOpen(true);
      return;
    }

    try {
      await joinCircle(circle.id, user.id);
    } catch (error) {
      // Error already handled in mutation
    }
  };

  const handleLeave = async () => {
    if (!user || !circle || !circleMembershipAction(circle.membership_state).canLeave) {
      throw new Error('Membership changed. Owners must transfer ownership or explicitly delete their Circle.');
    }
    return leaveCircle(circle.id, user.id);
  };

  const handleCancelSubscription = async () => {
    if (!user || !id) return;
    const { error } = await supabase.rpc('cancel_circle_subscription' as any, { _circle_id: id });
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['circle-subscription', id] });
      toast.success('Renewal cancelled. Access continues until the end of your paid period.');
    } else {
      toast.error('Failed to cancel subscription');
    }
  };

  const handleBack = () => {
    setActiveTab('circles');
    navigate('/', { replace: true });
  };

  // Land on the Feed, recover when the active tab points at a hidden section,
  // and translate old feature-id links (?tab=posts/videos/resources)
  useEffect(() => {
    if (!circle) return;
    const canManageCircle = circle.is_owned || circle.is_admin || false;
    const mapped = LEGACY_TAB_MAP[circleActiveTab] ?? circleActiveTab;
    const chatEnabled = circle.enabled_features.includes('messages');
    const valid: string[] = [
      ...getCircleNav(circle, canManageCircle),
      // Members management is owner/admin only; the messages chat room is also
      // open to joined members via the header shortcut
      ...(canManageCircle ? ['members'] : []),
      ...(chatEnabled && (canManageCircle || circle.is_joined) ? ['messages'] : []),
    ];
    if (!mapped || !valid.includes(mapped)) {
      setCircleActiveTab('feed');
    } else if (mapped !== circleActiveTab) {
      setCircleActiveTab(mapped);
    }
  }, [circle, circleActiveTab]);

  // Compact header slides in once the banner scrolls out of view
  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowMiniHeader(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [circle?.id]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full max-w-[480px] mx-auto bg-background text-foreground pb-20">
        <div className="relative">
          <div className="h-20" />
          <div className="absolute top-4 left-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </div>
        </div>
        <div className="min-h-64 flex items-center justify-center px-4">
          <SerkleLoader label="Loading circle" showText />
        </div>
      </div>
    );
  }

  if (!circle || isError) {
    return (
      <div className="min-h-[100dvh] w-full max-w-[480px] mx-auto bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Circle could not be loaded</h2>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          <Button onClick={handleBack}>Back to Circles</Button>
        </div>
      </div>
    );
  }

  const membership = circleMembershipAction(circle.membership_state);
  const canManage = membership.canManage;
  const typeConfig = getCircleType(circle.circle_type);
  const TypeIcon = typeConfig.icon;
  const navTabs = getCircleNav(circle, canManage);
  const isPremiumCircle = !!circle.subscription_enabled;
  const isVerifiedCreator = !!circle.creator?.is_verified;
  const messagesEnabled = circle.enabled_features.includes('messages');
  const tabsGridClass =
    ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'][navTabs.length - 1] ??
    'grid-cols-5';

  const subscriptionMenuItems = () => hasSubscription && <>
    <DropdownMenuLabel>Subscription (separate from membership)</DropdownMenuLabel>
    {subscription?.expires_at && <DropdownMenuItem onClick={() => setSubscribeModalOpen(true)}>Renew subscription</DropdownMenuItem>}
    <DropdownMenuItem disabled={subscription?.cancel_at_period_end} onClick={handleCancelSubscription}>
      {subscription?.cancel_at_period_end ? 'Renewal already cancelled' : 'Cancel renewal'}
    </DropdownMenuItem>
    <DropdownMenuSeparator />
  </>;

  const subscriptionMenu = () => hasSubscription && <DropdownMenu>
    <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Subscription<ChevronDown className="h-3.5 w-3.5 ml-1" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">{subscriptionMenuItems()}</DropdownMenuContent>
  </DropdownMenu>;

  /** Owner/admin tools — Dashboard, Members, Messages, Settings — live here only. */
  const manageMenu = (triggerClass = '') => (
    <div className="flex items-center gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className={triggerClass}>
          <Settings className="h-4 w-4 mr-1.5" />
          Manage
          <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Manage Circle</DropdownMenuLabel>
        {subscriptionMenuItems()}
        <DropdownMenuItem onClick={() => navigate(`/circle/${circle.id}/dashboard`)}>
          <LayoutDashboard className="h-4 w-4 mr-2" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => selectTab('members')}>
          <Users className="h-4 w-4 mr-2" />
          Members
        </DropdownMenuItem>
        {messagesEnabled && (
          <DropdownMenuItem onClick={() => selectTab('messages')}>
            <Mail className="h-4 w-4 mr-2" />
            Messages
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Circle
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSettingsModalOpen(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </DropdownMenuItem>
        {circle.is_owned && <DropdownMenuItem onClick={() => setOwnershipOptionsOpen(true)}>Transfer ownership or delete Circle</DropdownMenuItem>}
        {membership.canLeave && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setLeaveConfirmOpen(true)} disabled={isLeaving} className="text-destructive">Leave Circle</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
    {membership.canSubscribe && <Button size="sm" onClick={() => setSubscribeModalOpen(true)}>Subscribe</Button>}
    </div>
  );

  /** The same membership state appears in both headers. Subscription controls
   * are separate, so expired premium access never disguises an active member. */
  const membershipAction = (size: 'sm' | 'default' = 'sm', withIcons = false) => {
    if (circle.membership_state?.state !== 'joined') {
      return <div className="flex items-center gap-2">
        <CircleMembershipButton size={size} snapshot={circle.membership_state} busy={isJoining} onClick={handleJoinCircle} />
        {subscriptionMenu()}
        {membership.canLeave && <Button size={size} variant="outline" onClick={() => setLeaveConfirmOpen(true)} disabled={isLeaving}>Leave Circle</Button>}
        {membership.canSubscribe && <Button size={size} onClick={() => setSubscribeModalOpen(true)}>Subscribe</Button>}
      </div>;
    }
    // Joined (and subscribed, for paid circles): status chip with exit actions
    return (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size={size} variant="outline">
              Joined
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {subscriptionMenuItems()}
            <DropdownMenuItem onClick={() => setLeaveConfirmOpen(true)} disabled={isLeaving || !membership.canLeave} className="text-destructive">
              Leave Circle
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {membership.canSubscribe && <Button size={size} onClick={() => setSubscribeModalOpen(true)}>Subscribe</Button>}
        {withIcons && messagesEnabled && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => selectTab('messages')}
            aria-label="Circle messages"
          >
            <Mail className="h-4 w-4" />
          </Button>
        )}
        {withIcons && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={toggleNotifications}
            aria-label={notificationsEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            <Bell className={`h-4 w-4 ${notificationsEnabled ? 'fill-current' : ''}`} />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-[480px] mx-auto bg-background text-foreground relative border-l border-r border-border pb-24">
      {/* Sticky mini-header — appears when the banner scrolls away */}
      {showMiniHeader && (
        <div className="fixed top-0 inset-x-0 z-40 animate-fade-in">
          <div className="max-w-[480px] mx-auto bg-background/95 backdrop-blur-md border-b border-x border-border flex items-center gap-2 px-3 py-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleBack} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-[10px] font-semibold flex-shrink-0 overflow-hidden">
              {circle.avatar_url ? (
                <img src={circle.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                circle.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <p className="font-semibold text-sm truncate flex-1">{circle.name}</p>
            {canManage ? manageMenu() : membershipAction()}
          </div>
        </div>
      )}

      {/* Compact header: reduced banner + identity row */}
      <div className="relative">
        <div ref={bannerRef} className="h-28 overflow-hidden relative">
          {circle.cover_image_url ? (
            <img
              src={circle.cover_image_url}
              alt={circle.name}
              onLoad={() => setBannerLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-500 ${bannerLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          {/* Back Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="absolute top-3 left-3 h-8 w-8 bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 z-10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* Secondary actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 z-10">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {subscriptionMenuItems()}
              {circle.is_owned ? (
                <>
                  <DropdownMenuItem onClick={() => setSettingsModalOpen(true)}>Circle Settings</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setOwnershipOptionsOpen(true)}>Transfer ownership or delete Circle</DropdownMenuItem>
                </>
              ) : membership.canLeave ? (
                <DropdownMenuItem onClick={() => setLeaveConfirmOpen(true)} disabled={isLeaving} className="text-destructive">Leave Circle</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleJoinCircle} disabled={membership.disabled || isJoining}>{membership.label}</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => shareCircle(circle.id, circle.name)}>
                <Share2 className="h-4 w-4 mr-2" />
                Share Circle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Identity row: avatar + primary action, then name, creator, description.
            Positioned above the banner so the overlapping avatar isn't painted under it. */}
        <div className="relative z-10 px-4 pb-3">
          <div className="flex items-end justify-between -mt-8 mb-2">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white text-xl font-bold border-4 border-background shadow-lg overflow-hidden flex-shrink-0">
              {circle.avatar_url ? (
                <img src={circle.avatar_url} alt={circle.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                circle.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="mb-1">
              {canManage ? manageMenu() : membershipAction('sm', true)}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold leading-tight">{circle.name}</h1>
            {isPremiumCircle && (
              <Badge variant="secondary" className="text-badge gap-1">
                <Crown className="h-3 w-3" />
                Premium Circle
              </Badge>
            )}
          </div>

          {/* Creator — verification is the platform's, never implied by premium */}
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1.5"
            onClick={() => setProfileModalUserId(circle.creator_id)}
          >
            <span>by <span className="font-medium text-foreground">{circle.creator?.name || 'Unknown'}</span></span>
            {isVerifiedCreator && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BadgeCheck className="size-4 text-secondary cursor-pointer" aria-label="Verified Creator" />
                  </TooltipTrigger>
                  <TooltipContent><p>Verified Creator</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </button>

          {circle.description && (
            <div className="mb-2">
              <p className={`text-sm text-muted-foreground leading-relaxed ${descExpanded ? '' : 'line-clamp-2'}`}>
                {circle.description}
              </p>
              {circle.description.length > 120 && (
                <button
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setDescExpanded((v) => !v)}
                >
                  {descExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Compact meta: type, pricing, members, location */}
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted-foreground">
            <Badge variant="outline" className="text-badge gap-1">
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </Badge>
            <Badge variant="outline" className="text-badge">
              {displayCategory(circle.category)}
            </Badge>
            {!isPremiumCircle && (
              <Badge variant="outline" className="text-badge text-success border-success/30">Free</Badge>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {formatCircleCount(circle.members_count || 0, 'member')}
            </span>
            {circle.location && (
              <span className="flex items-center gap-1 min-w-0">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate max-w-[120px]">{circle.location}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Owner setup guide */}
      {canManage && (
        <CircleGettingStarted
          circle={circle}
          onEditCircle={() => setEditModalOpen(true)}
          onOpenTab={selectTab}
        />
      )}

      {/* Activity signals */}
      <CircleActivityStrip
        circle={circle}
        onOpenEvents={() => selectTab('events')}
        onOpenMembers={() => selectTab(canManage ? 'members' : 'about')}
      />

      {/* Public navigation: Feed | Learn | Events (| Services) | About */}
      <div className="border-t border-border">
        <Tabs value={circleActiveTab} onValueChange={selectTab} className="w-full">
          <div className="px-4 pt-3">
            <TabsList className={`grid ${tabsGridClass} h-9 w-full`}>
              {navTabs.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="text-xs px-1">
                  {CIRCLE_NAV_LABELS[tab]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="min-h-[400px]">
            <TabsContent value="feed" className="animate-fade-in">
              <CirclePosts circle={circle} isOwner={canManage} />
            </TabsContent>
            {navTabs.includes('learn') && (
              <TabsContent value="learn" className="animate-fade-in">
                <CircleLearn circle={circle} isOwner={canManage} />
              </TabsContent>
            )}
            {navTabs.includes('events') && (
              <TabsContent value="events" className="animate-fade-in">
                <CircleEvents circle={circle} isOwner={canManage} />
              </TabsContent>
            )}
            {navTabs.includes('services') && (
              <TabsContent value="services" className="animate-fade-in">
                <CircleServices circle={circle} isOwner={canManage} />
              </TabsContent>
            )}
            <TabsContent value="about" className="animate-fade-in">
              <CircleAbout circle={circle} onViewCreatorProfile={(userId) => setProfileModalUserId(userId)} />
            </TabsContent>

            {/* Manage Circle sections — owner/admin only, opened from the Manage menu */}
            {canManage && (
              <TabsContent value="members" className="animate-fade-in">
                <CircleMembers circle={circle} isOwner={canManage} onViewProfile={(userId) => setProfileModalUserId(userId)} />
              </TabsContent>
            )}
            {messagesEnabled && (canManage || circle.is_joined) && (
              <TabsContent value="messages" className="animate-fade-in">
                <CircleMessages circle={circle} isOwner={canManage} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>

      {/* Footer Navigation */}
      <FooterNav active={activeTab} onSelect={onTabSelect} onOpenCreate={onOpenCreate} />

      {/* Edit Circle Modal */}
      {circle && (
        <EditCircleModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          circle={circle}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Circle Settings Modal */}
      {circle && (
        <CircleSettingsModal
          open={settingsModalOpen}
          onOpenChange={setSettingsModalOpen}
          circle={circle}
        />
      )}

      {/* Subscribe Modal */}
      {circle && (
        <SubscribeCircleModal
          isOpen={subscribeModalOpen}
          onClose={() => setSubscribeModalOpen(false)}
          circleId={circle.id}
          circleName={circle.name}
          subscriptionPrice={circle.subscription_price}
          renewExpiresAt={subscription?.expires_at || undefined}
          onSubscribed={async () => {
            await refreshCircleMembership(queryClient);
            if (circle.subscription_method === 'before_join' && circle.membership_state?.state === 'subscription_required' && user) {
              try { await joinCircle(circle.id, user.id); } catch { /* The confirmed subscription remains active; joining can be retried. */ }
            }
          }}
        />
      )}

      <LeaveCircleDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}
        circleName={circle.name} isPrivate={circle.is_private} canLeave={membership.canLeave}
        subscriptionRequired={!!circle.subscription_enabled && circle.subscription_method === 'before_join'}
        onConfirm={handleLeave} onLeft={handleBack} />
      {circle.is_owned && <CircleManageModal circle={circle} open={ownershipOptionsOpen} onOpenChange={setOwnershipOptionsOpen} />}

      {/* Public Profile Modal */}
      {profileModalUserId && (
        <PublicProfileModal
          isOpen={!!profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
          userId={profileModalUserId}
        />
      )}
    </div>
  );
};

export default CircleDetail;
