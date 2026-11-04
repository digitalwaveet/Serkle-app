import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  TrendingUp, Users, FileText, Video, Clock, Award, BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';

interface CreatorLeaderboard {
  user_id: string;
  username: string;
  name: string;
  avatar_url: string | null;
  posts_count: number;
  videos_count: number;
  total: number;
}

interface DailyCount {
  date: string;
  label: string;
  posts: number;
  videos: number;
}

interface HourlyActivity {
  hour: number;
  label: string;
  count: number;
}

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 220 70% 50%))',
  'hsl(var(--chart-3, 280 65% 55%))',
  'hsl(var(--chart-4, 30 80% 55%))',
  'hsl(var(--chart-5, 160 60% 45%))',
];

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [creators, setCreators] = useState<CreatorLeaderboard[]>([]);
  const [dailyContent, setDailyContent] = useState<DailyCount[]>([]);
  const [hourlyActivity, setHourlyActivity] = useState<HourlyActivity[]>([]);
  const [contentBreakdown, setContentBreakdown] = useState<any[]>([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchRetention(),
      fetchCreatorLeaderboard(),
      fetchDailyContentRate(),
      fetchHourlyActivity(),
      fetchContentBreakdown(),
    ]);
    setLoading(false);
  };

  const fetchRetention = async () => {
    // Simulate retention: compare weekly cohort sizes (users who created profile in week N and posted in week N+1)
    const weeks: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);

      const { count: signups } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString());

      const { count: activePosters } = await supabase
        .from('posts')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString());

      const total = signups || 1;
      const active = activePosters || 0;
      const label = `W-${i}`;

      weeks.push({
        label,
        signups: signups || 0,
        active,
        retention: Math.round((active / total) * 100),
      });
    }
    setRetentionData(weeks);
  };

  const fetchCreatorLeaderboard = async () => {
    // Get top creators by post + video count using profile_stats
    const { data } = await supabase
      .from('profile_stats')
      .select('user_id, posts_count, videos_count, profiles!inner(username, name, avatar_url)')
      .order('posts_count', { ascending: false })
      .limit(10);

    if (data) {
      const mapped: CreatorLeaderboard[] = data.map((d: any) => ({
        user_id: d.user_id,
        username: d.profiles?.username || 'unknown',
        name: d.profiles?.name || 'Unknown',
        avatar_url: d.profiles?.avatar_url,
        posts_count: d.posts_count || 0,
        videos_count: d.videos_count || 0,
        total: (d.posts_count || 0) + (d.videos_count || 0),
      }));
      mapped.sort((a, b) => b.total - a.total);
      setCreators(mapped.slice(0, 10));
    }
  };

  const fetchDailyContentRate = async () => {
    const days: DailyCount[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [postsRes, videosRes] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lt('created_at', dayEnd.toISOString()),
        supabase.from('videos').select('id', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lt('created_at', dayEnd.toISOString()),
      ]);

      days.push({
        date: dayStart.toISOString(),
        label: dayStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        posts: postsRes.count || 0,
        videos: videosRes.count || 0,
      });
    }
    setDailyContent(days);
  };

  const fetchHourlyActivity = async () => {
    // Get posts from last 7 days and group by hour
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: posts } = await supabase
      .from('posts')
      .select('created_at')
      .gte('created_at', sevenDaysAgo.toISOString());

    const hourCounts = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      count: 0,
    }));

    posts?.forEach((p) => {
      const h = new Date(p.created_at).getHours();
      hourCounts[h].count++;
    });

    setHourlyActivity(hourCounts);
  };

  const fetchContentBreakdown = async () => {
    const [posts, videos, circles, questions] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('videos').select('id', { count: 'exact', head: true }),
      supabase.from('circles').select('id', { count: 'exact', head: true }),
      supabase.from('questions').select('id', { count: 'exact', head: true }),
    ]);

    setContentBreakdown([
      { name: 'Posts', value: posts.count || 0 },
      { name: 'Videos', value: videos.count || 0 },
      { name: 'Circles', value: circles.count || 0 },
      { name: 'Questions', value: questions.count || 0 },
    ]);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Growth & Engagement Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="md" label="Loading data" /></div>
        </div>
      </div>
    );
  }

  const maxHourly = Math.max(...hourlyActivity.map(h => h.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Growth & Engagement Analytics</h1>
        <Badge variant="outline" className="text-xs">Last 14 days</Badge>
      </div>

      {/* Weekly Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Weekly Retention (Signups vs Active Posters)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={retentionData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Area type="monotone" dataKey="signups" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} name="Signups" />
              <Area type="monotone" dataKey="active" stackId="2" stroke="hsl(var(--chart-2, 160 60% 45%))" fill="hsl(var(--chart-2, 160 60% 45%))" fillOpacity={0.3} name="Active Posters" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Content Creation Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Content Creation Rate (14 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyContent}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs" angle={-45} textAnchor="end" height={50} />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="posts" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name="Posts" />
                <Bar dataKey="videos" fill="hsl(var(--chart-2, 280 65% 55%))" radius={[2, 2, 0, 0]} name="Videos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Content Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Content Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={contentBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {contentBreakdown.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Peak Usage Hours Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Peak Usage Hours (Posts, Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-1">
            {hourlyActivity.map((h) => {
              const intensity = h.count / maxHourly;
              return (
                <div
                  key={h.hour}
                  className="flex flex-col items-center gap-1"
                  title={`${h.label}: ${h.count} posts`}
                >
                  <div
                    className="w-full aspect-square rounded-sm transition-colors"
                    style={{
                      backgroundColor: `hsl(var(--primary) / ${Math.max(0.08, intensity)})`,
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground">{h.hour}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Darker = more activity. Hours are in your local timezone.
          </p>
        </CardContent>
      </Card>

      {/* Creator Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Top Creators Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {creators.length === 0 ? (
            <p className="text-sm text-muted-foreground">No creators found.</p>
          ) : (
            <div className="space-y-2">
              {creators.map((c, idx) => (
                <div key={c.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                    {idx + 1}
                  </span>
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      c.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">@{c.username}</p>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{c.posts_count} posts</span>
                    <span>{c.videos_count} videos</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{c.total}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
