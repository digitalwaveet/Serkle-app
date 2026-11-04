import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, FileText, Video, MessageSquare, TrendingUp, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalVideos: number;
  totalMessages: number;
  totalReports: number;
  bannedUsers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalPosts: 0, totalVideos: 0,
    totalMessages: 0, totalReports: 0, bannedUsers: 0,
  });
  const [signupData, setSignupData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, postsRes, videosRes, messagesRes, reportsRes, bannedRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('posts').select('id', { count: 'exact', head: true }),
          supabase.from('videos').select('id', { count: 'exact', head: true }),
          supabase.from('messages').select('id', { count: 'exact', head: true }),
          supabase.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).not('banned_at', 'is', null),
        ]);

        setStats({
          totalUsers: usersRes.count || 0,
          totalPosts: postsRes.count || 0,
          totalVideos: videosRes.count || 0,
          totalMessages: messagesRes.count || 0,
          totalReports: reportsRes.count || 0,
          bannedUsers: bannedRes.count || 0,
        });

        // Fetch signup data for last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: recentUsers } = await supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: true });

        if (recentUsers) {
          const grouped: Record<string, number> = {};
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('en', { weekday: 'short' });
            grouped[key] = 0;
          }
          recentUsers.forEach((u) => {
            const key = new Date(u.created_at).toLocaleDateString('en', { weekday: 'short' });
            if (grouped[key] !== undefined) grouped[key]++;
          });
          setSignupData(Object.entries(grouped).map(([name, value]) => ({ name, signups: value })));
        }
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-600' },
    { title: 'Total Posts', value: stats.totalPosts, icon: FileText, color: 'text-green-600' },
    { title: 'Total Videos', value: stats.totalVideos, icon: Video, color: 'text-purple-600' },
    { title: 'Messages', value: stats.totalMessages, icon: MessageSquare, color: 'text-orange-600' },
    { title: 'Pending Reports', value: stats.totalReports, icon: Shield, color: 'text-red-600' },
    { title: 'Banned Users', value: stats.bannedUsers, icon: TrendingUp, color: 'text-destructive' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="md" label="Loading data" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Sign-ups (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={signupData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign-up Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={signupData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="signups" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
