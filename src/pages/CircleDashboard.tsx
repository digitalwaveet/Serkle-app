import { circleMembershipAction } from '@/lib/circleMembershipState';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, MessageSquare, Video, FolderOpen, CalendarDays, Crown, Coins, Heart, MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCircle } from '@/hooks/useCircles';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCircleNumber, getCircleCountLabel, type CircleCountUnit } from '@/lib/circleCountFormat';

const WEEKS_SHOWN = 8;

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Ease-out count-up for stat tiles. */
const useCountUp = (target: number, duration = 600) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) {
      setValue(target);
      return;
    }
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
};

const StatTile: React.FC<{ icon: React.ElementType; unit: CircleCountUnit; value: number }> = ({ icon: Icon, unit, value }) => {
  const displayed = useCountUp(value);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{getCircleCountLabel(displayed, unit)}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{formatCircleNumber(displayed)}</p>
      </CardContent>
    </Card>
  );
};

const CircleDashboard: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();

  const { data: circle, isLoading, isError } = useCircle(id!, user?.id);
  const canManage = !isError && circleMembershipAction(circle?.membership_state).canManage;

  const { data: subscriberCount = 0 } = useQuery({
    queryKey: ['circle-subscriber-count', id],
    queryFn: async () => {
      const { count } = await supabase
        .from('circle_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('circle_id', id!)
        .eq('status', 'active');
      return count ?? 0;
    },
    enabled: !!id && canManage,
  });

  const { data: tipsTotal = 0 } = useQuery({
    queryKey: ['circle-tips-total', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('circle_tips')
        .select('amount, posts!inner(circle_id)')
        .eq('posts.circle_id', id!);
      return (data ?? []).reduce((sum, tip: any) => sum + (tip.amount || 0), 0);
    },
    enabled: !!id && canManage,
  });

  const { data: memberGrowth = [] } = useQuery({
    queryKey: ['circle-member-growth', id],
    queryFn: async () => {
      const since = subWeeks(new Date(), WEEKS_SHOWN);
      const { data } = await supabase
        .from('circle_members')
        .select('joined_at')
        .eq('circle_id', id!)
        .eq('status', 'active')
        .gte('joined_at', since.toISOString());

      // Bucket joins per week for the chart
      const buckets = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
        const weekStart = startOfWeek(subWeeks(new Date(), WEEKS_SHOWN - 1 - i), { weekStartsOn: 1 });
        return { key: weekStart.getTime(), label: format(weekStart, 'MMM d'), count: 0 };
      });
      (data ?? []).forEach((row) => {
        if (!row.joined_at) return;
        const joined = startOfWeek(new Date(row.joined_at), { weekStartsOn: 1 }).getTime();
        const bucket = buckets.find((b) => b.key === joined);
        if (bucket) bucket.count += 1;
      });
      return buckets;
    },
    enabled: !!id && canManage,
  });

  const { data: topPosts = [] } = useQuery({
    queryKey: ['circle-top-posts', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, content, created_at, post_stats(likes_count, comments_count)')
        .eq('circle_id', id!)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data ?? [])
        .map((post: any) => ({
          id: post.id,
          content: stripHtml(post.content || ''),
          created_at: post.created_at,
          likes: post.post_stats?.likes_count ?? 0,
          comments: post.post_stats?.comments_count ?? 0,
        }))
        .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
        .slice(0, 5);
    },
    enabled: !!id && canManage,
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center py-8"><SerkleLoader label="Loading circles" showText /></div>
    );
  }

  if (!circle || !canManage) {
    return (
      <div className="min-h-[100dvh] w-full max-w-[480px] mx-auto bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-3">
          <h2 className="text-xl font-bold">Dashboard unavailable</h2>
          <p className="text-sm text-muted-foreground">Only circle admins can view analytics.</p>
          <Button onClick={() => navigate(id ? `/circle/${id}` : '/')}>Back to Circle</Button>
        </div>
      </div>
    );
  }

  const statTiles = [
    { icon: Users, unit: 'member' as const, value: circle.members_count || 0 },
    { icon: MessageSquare, unit: 'post' as const, value: circle.posts_count || 0 },
    { icon: Video, unit: 'video' as const, value: circle.videos_count || 0 },
    { icon: FolderOpen, unit: 'resource' as const, value: circle.resources_count || 0 },
    { icon: CalendarDays, unit: 'event' as const, value: circle.events_count || 0 },
    { icon: Crown, unit: 'subscriber' as const, value: subscriberCount },
  ];

  const estMonthlyRevenue = subscriberCount * (circle.subscription_price || 0);

  return (
    <div className="min-h-[100dvh] w-full max-w-[480px] mx-auto bg-background text-foreground border-l border-r border-border pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/circle/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Circle Dashboard</h1>
            <p className="text-xs text-muted-foreground truncate">{circle.name}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3">
          {statTiles.map(({ icon, unit, value }) => (
            <StatTile key={unit} icon={icon} unit={unit} value={value} />
          ))}
        </div>

        {/* Revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4 text-secondary" />
              Earnings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Est. monthly subscriptions</span>
              <span className="font-semibold">
                {circle.subscription_enabled ? `${estMonthlyRevenue.toLocaleString()} coins` : 'Free circle'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tips received</span>
              <span className="font-semibold">{tipsTotal.toLocaleString()} coins</span>
            </div>
          </CardContent>
        </Card>

        {/* Member growth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New members per week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberGrowth} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [value, `New ${getCircleCountLabel(value, 'member')}`]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top posts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top posts</CardTitle>
          </CardHeader>
          <CardContent>
            {topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Publish posts to see what resonates with your members.
              </p>
            ) : (
              <div className="space-y-3">
                {topPosts.map((post, index) => (
                  <button
                    key={post.id}
                    onClick={() => navigate(`/circle/${id}/post/${post.id}`)}
                    className="flex items-center gap-3 w-full text-left hover:bg-muted/40 rounded-lg p-2 -mx-2 transition-colors"
                  >
                    <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {post.content || 'Untitled post'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {post.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {post.comments}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CircleDashboard;
