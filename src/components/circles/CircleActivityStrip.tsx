import React from 'react';
import { CalendarDays, Clock, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { type Circle } from '@/hooks/useCircles';
import { formatCircleCount } from '@/lib/circleCountFormat';
import { lastActiveText } from '@/lib/presenceStatus';

interface CircleActivityStripProps {
  circle: Circle;
  onOpenEvents: () => void;
  onOpenMembers: () => void;
}

interface RecentMember {
  user_id: string;
  joined_at: string | null;
  profiles: {
    name: string | null;
    avatar_url: string | null;
    initials: string | null;
    avatar_color: string | null;
  } | null;
}

/**
 * "Alive" signals under the circle header: next event, newest members and
 * how recently the circle was active. Renders nothing when there is no signal.
 */
const CircleActivityStrip: React.FC<CircleActivityStripProps> = ({ circle, onOpenEvents, onOpenMembers }) => {
  const { data: upcomingEvent } = useQuery({
    queryKey: ['circle-next-event', circle.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('circle_events')
        .select('id, title, event_date, event_time')
        .eq('circle_id', circle.id)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true })
        .limit(1);
      return data?.[0] ?? null;
    },
    enabled: !!circle.id && circle.enabled_features.includes('events'),
  });

  const { data: recentMembers = [] } = useQuery({
    queryKey: ['circle-recent-members', circle.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('circle_members')
        .select('user_id, joined_at, profiles:user_id (name, avatar_url, initials, avatar_color)')
        .eq('circle_id', circle.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false })
        .limit(3);
      return (data ?? []) as unknown as RecentMember[];
    },
    enabled: !!circle.id,
  });

  const activityLabel = lastActiveText(circle.last_activity_at);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = recentMembers.filter(
    (m) => m.joined_at && new Date(m.joined_at).getTime() > weekAgo
  ).length;

  const hasSignals = !!upcomingEvent || recentMembers.length > 0 || !!activityLabel;
  if (!hasSignals) return null;

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {upcomingEvent && (
          <button
            onClick={onOpenEvents}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/50 hover:border-primary/40 transition-colors flex-shrink-0"
          >
            <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="text-left">
              <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{upcomingEvent.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(upcomingEvent.event_date), 'MMM d')} · {upcomingEvent.event_time?.slice(0, 5)}
              </p>
            </div>
          </button>
        )}

        {recentMembers.length > 0 && (
          <button
            onClick={onOpenMembers}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/50 hover:border-primary/40 transition-colors flex-shrink-0"
          >
            <div className="flex -space-x-2">
              {recentMembers.map((member) =>
                member.profiles?.avatar_url ? (
                  <img
                    key={member.user_id}
                    src={member.profiles.avatar_url}
                    alt={member.profiles.name || 'Member'}
                    className="h-6 w-6 rounded-full object-cover border-2 border-background"
                  />
                ) : (
                  <div
                    key={member.user_id}
                    className="h-6 w-6 rounded-full bg-gradient-primary border-2 border-background flex items-center justify-center text-[9px] font-semibold text-primary-foreground"
                  >
                    {member.profiles?.initials || member.profiles?.name?.slice(0, 2).toUpperCase() || '??'}
                  </div>
                )
              )}
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-foreground">
                {newThisWeek > 0 ? `${newThisWeek} joined this week` : 'Recently joined'}
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {formatCircleCount(circle.members_count || 0, 'member')}
              </p>
            </div>
          </button>
        )}

        {activityLabel && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/50 flex-shrink-0">
            <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {activityLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CircleActivityStrip;
