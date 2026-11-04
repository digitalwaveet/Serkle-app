import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useCircleMutations } from '@/hooks/useCircleMutations';
import { Users } from 'lucide-react';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CircleMembershipButton } from '@/components/circles/CircleMembershipButton';
import { SubscribeCircleModal } from '@/components/circles/SubscribeCircleModal';
import { circleMembershipAction, validateCircleSnapshot } from '@/lib/circleMembershipState';
import { membershipQueryOptions, refreshCircleMembership } from '@/lib/circleMembershipClient';
import { circleLoginPath } from '@/lib/authReturnPath';
import { displayCategory } from '@/lib/circleTypes';
import { formatCircleCount } from '@/lib/circleCountFormat';

const JoinCircle: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { joinCircle, isJoining } = useCircleMutations();
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const { data: circle, isLoading, isError, refetch } = useQuery({
    queryKey: ['circle-invite-preview', inviteCode, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_circle_invite_preview' as any, { _invite_code: inviteCode });
      if (error) throw error;
      if (!data) return null;
      const preview = data as any;
      validateCircleSnapshot(preview.membership_state, preview.id, user?.id);
      return preview;
    },
    enabled: !!inviteCode && !!user,
    ...membershipQueryOptions,
  });

  if (!user) return <div className="min-h-[100dvh] flex flex-col gap-4 items-center justify-center bg-background">
    <p>Sign in to view this Circle invitation</p>
    <Button onClick={() => navigate(circleLoginPath(`/join/${inviteCode}`))}>Sign in</Button>
  </div>;

  if (isLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><VideoLoader size="md" /></div>;
  if (!circle || isError) return <div className="min-h-[100dvh] flex flex-col gap-4 items-center justify-center bg-background p-6 text-center">
    <Users className="w-16 h-16 text-muted-foreground" />
    <h1 className="text-xl font-bold">{isError ? 'Could not load Circle invitation' : 'Invalid Invite Link'}</h1>
    <p className="text-muted-foreground">{isError ? 'Check your connection and retry.' : "This invite link is expired or doesn't exist."}</p>
    {isError && <Button onClick={() => refetch()}>Retry</Button>}
    <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
  </div>;

  const snapshot = circle.membership_state;
  const action = circleMembershipAction(snapshot);
  const join = async () => {
    try {
      const result = await joinCircle(circle.id, user.id);
      if (result.state === 'subscription_required') setSubscribeOpen(true);
      else if (['owner', 'manager', 'joined', 'pending'].includes(result.state)) navigate(`/circle/${circle.id}`);
    } catch { /* The mutation displays a retryable error. */ }
  };
  const handleAction = () => {
    if (action.canManage) navigate(`/circle/${circle.id}/dashboard`);
    else if (action.isJoined) navigate(`/circle/${circle.id}`);
    else if (snapshot.state === 'subscription_required') setSubscribeOpen(true);
    else void join();
  };

  return <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 text-center">
    <Avatar className="w-20 h-20 mb-4">
      <AvatarImage src={circle.avatar_url || ''} />
      <AvatarFallback className="text-2xl">{circle.name?.[0]}</AvatarFallback>
    </Avatar>
    <h1 className="text-xl font-bold mb-1">{circle.name}</h1>
    <p className="text-sm text-muted-foreground mb-1">{displayCategory(circle.category)}</p>
    <p className="text-sm text-muted-foreground mb-1">{formatCircleCount(circle.members_count, 'member')}</p>
    <p className="text-sm text-foreground/80 mb-6 max-w-xs">{circle.description}</p>
    {snapshot.state === 'owner' && <p className="text-sm mb-4">You own this Circle.</p>}
    <div className="flex gap-2">
      <CircleMembershipButton snapshot={snapshot} busy={isJoining} onClick={handleAction} size="default" />
      {action.canSubscribe && <Button onClick={() => setSubscribeOpen(true)}>Subscribe</Button>}
    </div>
    <SubscribeCircleModal isOpen={subscribeOpen} onClose={() => setSubscribeOpen(false)}
      circleId={circle.id} circleName={circle.name} subscriptionPrice={circle.subscription_price}
      onSubscribed={async () => {
        await refreshCircleMembership(queryClient);
        if (snapshot.state === 'subscription_required') await join();
      }} />
  </div>;
};

export default JoinCircle;
