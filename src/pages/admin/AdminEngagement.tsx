import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, UserCheck, TrendingDown, Target, Flame,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts';

interface CohortRow {
  cohort: string;
  total: number;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
}

interface EngagementTier {
  tier: string;
  count: number;
  color: string;
}

interface FunnelStep {
  name: string;
  value: number;
  pct: number;
}

export default function AdminEngagement() {
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [tiers, setTiers] = useState<EngagementTier[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [dailyActive, setDailyActive] = useState<any[]>([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchCohorts(),
      fetchEngagementTiers(),
      fetchFunnel(),
      fetchDAU(),
    ]);
    setLoading(false);
  };

  const fetchCohorts = async () => {
    // Build 4 weekly cohorts and measure retention
    const rows: CohortRow[] = [];
    for (let c = 3; c >= 0; c--) {
      const cohortStart = new Date();
      cohortStart.setDate(cohortStart.getDate() - (c + 1) * 7);
      const cohortEnd = new Date();
      cohortEnd.setDate(cohortEnd.getDate() - c * 7);

      const { count: total } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', cohortStart.toISOString())
        .lt('created_at', cohortEnd.toISOString());

      const weekRetention: number[] = [];
      for (let w = 0; w < 4; w++) {
        const wStart = new Date(cohortEnd);
        wStart.setDate(wStart.getDate() + w * 7);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 7);

        if (wEnd > new Date()) {
          weekRetention.push(-1); // future
          continue;
        }

        const { count: active } = await supabase
          .from('posts')
          .select('user_id', { count: 'exact', head: true })
          .gte('created_at', wStart.toISOString())
          .lt('created_at', wEnd.toISOString());

        weekRetention.push(total ? Math.round(((active || 0) / total) * 100) : 0);
      }

      rows.push({
        cohort: cohortStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        total: total || 0,
        week1: weekRetention[0],
        week2: weekRetention[1],
        week3: weekRetention[2],
        week4: weekRetention[3],
      });
    }
    setCohorts(rows);
  };

  const fetchEngagementTiers = async () => {
    // Classify users by their post count from profile_stats
    const { data } = await supabase
      .from('profile_stats')
      .select('posts_count, videos_count');

    if (!data) return;

    let power = 0, active = 0, casual = 0, lurkers = 0;
    data.forEach((d: any) => {
      const total = (d.posts_count || 0) + (d.videos_count || 0);
      if (total >= 20) power++;
      else if (total >= 5) active++;
      else if (total >= 1) casual++;
      else lurkers++;
    });

    setTiers([
      { tier: 'Power Users (20+)', count: power, color: 'hsl(var(--primary))' },
      { tier: 'Active (5-19)', count: active, color: 'hsl(var(--chart-2, 160 60% 45%))' },
      { tier: 'Casual (1-4)', count: casual, color: 'hsl(var(--chart-3, 280 65% 55%))' },
      { tier: 'Lurkers (0)', count: lurkers, color: 'hsl(var(--chart-4, 30 80% 55%))' },
    ]);
  };

  const fetchFunnel = async () => {
    const [profiles, posters, commenters, likers] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profile_stats').select('user_id', { count: 'exact', head: true }).gt('posts_count', 0),
      supabase.from('comments').select('user_id', { count: 'exact', head: true }),
      supabase.from('likes').select('user_id', { count: 'exact', head: true }),
    ]);

    const total = profiles.count || 1;
    const steps: FunnelStep[] = [
      { name: 'Signed Up', value: total, pct: 100 },
      { name: 'Liked Content', value: likers.count || 0, pct: Math.round(((likers.count || 0) / total) * 100) },
      { name: 'Commented', value: commenters.count || 0, pct: Math.round(((commenters.count || 0) / total) * 100) },
      { name: 'Created Post', value: posters.count || 0, pct: Math.round(((posters.count || 0) / total) * 100) },
    ];
    setFunnel(steps);
  };

  const fetchDAU = async () => {
    const days: any[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const { count } = await supabase
        .from('posts')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString());

      days.push({
        label: dayStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        dau: count || 0,
      });
    }
    setDailyActive(days);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">User Engagement</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="md" label="Loading data" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">User Engagement & Cohorts</h1>
      </div>

      {/* User Engagement Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            User Journey Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnel.map((step, idx) => (
              <div key={step.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground font-medium">{step.name}</span>
                  <span className="text-muted-foreground">{step.value.toLocaleString()} ({step.pct}%)</span>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all"
                    style={{
                      width: `${step.pct}%`,
                      backgroundColor: `hsl(var(--primary) / ${1 - idx * 0.2})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Engagement Tiers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" />
              Engagement Tiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={tiers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="tier" className="text-xs" width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Active Posters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              Daily Active Posters (14 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailyActive}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs" angle={-45} textAnchor="end" height={50} />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area type="monotone" dataKey="dau" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="Active Posters" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cohort Retention Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Weekly Cohort Retention
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Cohort</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Users</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Week 1</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Week 2</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Week 3</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Week 4</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map(c => (
                  <tr key={c.cohort} className="border-b border-border/50">
                    <td className="p-2 text-foreground font-medium">{c.cohort}</td>
                    <td className="p-2 text-center text-foreground">{c.total}</td>
                    {[c.week1, c.week2, c.week3, c.week4].map((val, i) => (
                      <td key={i} className="p-2 text-center">
                        {val < 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: `hsl(var(--primary) / ${Math.min(val / 100, 1) * 0.5 + 0.05})`,
                              color: val > 50 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                            }}
                          >
                            {val}%
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Retention = % of cohort users who posted in that week. "—" = future data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
