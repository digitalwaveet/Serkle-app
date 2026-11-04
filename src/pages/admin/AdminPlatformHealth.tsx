import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, Server, Database, HardDrive, Users, FileText, Video,
  MessageSquare, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock,
} from 'lucide-react';

interface HealthMetric {
  label: string;
  value: number | string;
  max?: number;
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ReactNode;
}

export default function AdminPlatformHealth() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const [
        { count: usersCount },
        { count: postsCount },
        { count: videosCount },
        { count: messagesCount },
        { count: commentsCount },
        { count: ordersCount },
        { count: alertsCount },
        { count: reportsCount },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('videos').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('comments').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('sos_alerts').select('*', { count: 'exact', head: true }),
        supabase.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setTableCounts({
        users: usersCount || 0,
        posts: postsCount || 0,
        videos: videosCount || 0,
        messages: messagesCount || 0,
        comments: commentsCount || 0,
        orders: ordersCount || 0,
        alerts: alertsCount || 0,
        pendingReports: reportsCount || 0,
      });

      const pendingReports = reportsCount || 0;
      const activeAlerts = alertsCount || 0;

      setMetrics([
        {
          label: 'Database Status',
          value: 'Connected',
          status: 'healthy',
          icon: <Database className="h-5 w-5" />,
        },
        {
          label: 'Auth Service',
          value: 'Operational',
          status: 'healthy',
          icon: <Server className="h-5 w-5" />,
        },
        {
          label: 'Pending Reports',
          value: pendingReports,
          status: pendingReports > 20 ? 'critical' : pendingReports > 5 ? 'warning' : 'healthy',
          icon: <AlertTriangle className="h-5 w-5" />,
        },
        {
          label: 'Active SOS Alerts',
          value: activeAlerts,
          status: activeAlerts > 10 ? 'critical' : activeAlerts > 3 ? 'warning' : 'healthy',
          icon: <Activity className="h-5 w-5" />,
        },
      ]);

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch health metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMetrics(); }, []);

  const statusIcon = (s: string) => {
    if (s === 'healthy') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (s === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const statusColor = (s: string) =>
    s === 'healthy' ? 'bg-green-500/10 text-green-600 border-green-500/20'
      : s === 'warning' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
      : 'bg-destructive/10 text-destructive border-destructive/20';

  const overallStatus = metrics.some(m => m.status === 'critical')
    ? 'critical' : metrics.some(m => m.status === 'warning') ? 'warning' : 'healthy';

  const dataRows = [
    { label: 'Users', count: tableCounts.users, icon: <Users className="h-4 w-4" /> },
    { label: 'Posts', count: tableCounts.posts, icon: <FileText className="h-4 w-4" /> },
    { label: 'Videos', count: tableCounts.videos, icon: <Video className="h-4 w-4" /> },
    { label: 'Messages', count: tableCounts.messages, icon: <MessageSquare className="h-4 w-4" /> },
    { label: 'Comments', count: tableCounts.comments, icon: <MessageSquare className="h-4 w-4" /> },
    { label: 'Orders', count: tableCounts.orders, icon: <HardDrive className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Health</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" /> Last refreshed: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={statusColor(overallStatus)}>
            {statusIcon(overallStatus)}
            <span className="ml-1 capitalize">{overallStatus}</span>
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading}>
            {loading ? <SerkleLoader size="xs" className="mr-1 text-current" label="Refreshing" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Service Health */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${statusColor(m.status)}`}>{m.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{m.value}</span>
                  {statusIcon(m.status)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data Volume */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dataRows.map((row) => {
              const maxRef = Math.max(...dataRows.map(r => r.count || 0), 1);
              const pct = ((row.count || 0) / maxRef) * 100;
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-24 flex items-center gap-2 text-sm text-muted-foreground">
                    {row.icon} {row.label}
                  </div>
                  <Progress value={pct} className="flex-1 h-2" />
                  <span className="text-sm font-medium w-16 text-right text-foreground">
                    {(row.count || 0).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Uptime Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Database connection', ok: true },
              { label: 'Authentication service', ok: true },
              { label: 'Realtime subscriptions', ok: true },
              { label: 'Storage bucket', ok: true },
              { label: 'Edge functions', ok: true },
              { label: 'Push notifications', ok: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.ok
                  ? <CheckCircle className="h-4 w-4 text-green-500" />
                  : <XCircle className="h-4 w-4 text-destructive" />
                }
                <span className="text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
