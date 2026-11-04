import React, { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart3, StopCircle, Eye, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePollData, useVoterInsights } from '@/hooks/useGroupManagement';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface PollMessageBubbleProps {
  pollId: string;
  isOwn: boolean;
  currentUserId: string;
}

const PollMessageBubble: React.FC<PollMessageBubbleProps> = ({ pollId, isOwn, currentUserId }) => {
  const queryClient = useQueryClient();
  const { data: poll, isLoading } = usePollData(pollId);
  const [showInsights, setShowInsights] = useState(false);

  const isCreator = poll?.creator_id === currentUserId;
  const isEnded = (poll as any)?.status === 'ended';

  const { data: voterInsights = [] } = useVoterInsights(pollId, showInsights && isCreator);

  const voteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, user_id: currentUserId, option_id: optionId });
      if (error && error.code === '23505') { toast.info('Already voted'); return; }
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['poll-data', pollId] }),
  });

  const unvoteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      const { error } = await supabase.from('poll_votes').delete().eq('poll_id', pollId).eq('user_id', currentUserId).eq('option_id', optionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['poll-data', pollId] }),
  });

  const endPollMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('group_polls')
        .update({ status: 'ended', ended_at: new Date().toISOString() } as any)
        .eq('id', pollId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poll-data', pollId] });
      toast.success('Poll ended');
    },
  });

  if (isLoading || !poll) {
    return (
      <div className="p-3 rounded-xl min-w-[240px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span className="text-sm">Loading poll...</span>
        </div>
      </div>
    );
  }

  const options = (poll.options || []) as any[];
  const votes = poll.poll_votes || [];
  const totalVotes = votes.length;
  const userVotes = votes.filter((v: any) => v.user_id === currentUserId).map((v: any) => v.option_id);
  const hasVoted = userVotes.length > 0;

  return (
    <div className={`rounded-xl min-w-[260px] max-w-[320px] ${isOwn ? 'bg-primary/10' : 'bg-muted/80'}`}>
      {/* Header */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{poll.question}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {poll.is_anonymous && <span className="flex items-center gap-0.5"><Lock className="h-3 w-3" /> Anonymous</span>}
          {isEnded && <span className="text-destructive font-medium">Poll ended</span>}
          {poll.is_multiple_choice && <span>Multiple choice</span>}
        </div>
      </div>

      {/* Options */}
      <div className="px-3 py-2 space-y-1.5">
        {options.map((opt: any) => {
          const optVotes = votes.filter((v: any) => v.option_id === opt.id).length;
          const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
          const voted = userVotes.includes(opt.id);

          return (
            <button
              key={opt.id}
              className={`w-full text-left rounded-lg px-2.5 py-1.5 transition-colors ${
                isEnded ? 'cursor-default' : 'hover:bg-background/50 active:bg-background/70'
              } ${voted ? 'ring-1 ring-primary/50' : ''}`}
              onClick={() => {
                if (isEnded) return;
                if (voted) unvoteMutation.mutate(opt.id);
                else voteMutation.mutate(opt.id);
              }}
              disabled={isEnded}
            >
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className={voted ? 'font-semibold text-primary' : 'text-foreground'}>{opt.text}</span>
                <span className="text-muted-foreground ml-2">{hasVoted || isEnded ? `${pct}%` : ''}</span>
              </div>
              {(hasVoted || isEnded) && <Progress value={pct} className="h-1.5" />}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
        {isCreator && !isEnded && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); endPollMutation.mutate(); }}
          >
            <StopCircle className="h-3 w-3 mr-1" /> End Poll
          </Button>
        )}
        {isCreator && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={(e) => { e.stopPropagation(); setShowInsights(!showInsights); }}
          >
            <Eye className="h-3 w-3 mr-1" />
            {showInsights ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>

      {/* Voter Insights (creator only) */}
      {showInsights && isCreator && (
        <div className="border-t border-border/50 px-3 py-2">
          <p className="text-xs font-medium mb-1.5 text-muted-foreground">Who voted what</p>
          <ScrollArea className="max-h-[150px]">
            {options.map((opt: any) => {
              const optVoters = voterInsights.filter(v => v.option_id === opt.id);
              if (optVoters.length === 0) return null;
              return (
                <div key={opt.id} className="mb-2">
                  <p className="text-xs font-medium text-primary mb-1">{opt.text}</p>
                  <div className="space-y-1 pl-2">
                    {optVoters.map(voter => (
                      <div key={voter.user_id} className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={voter.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">{voter.profile?.initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs truncate">{voter.profile?.name || 'Unknown'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {poll.is_anonymous && (
              <p className="text-xs text-muted-foreground italic">This is an anonymous poll — voter identities are hidden from other members.</p>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default PollMessageBubble;
