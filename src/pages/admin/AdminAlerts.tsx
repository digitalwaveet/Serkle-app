import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, FileWarning, TrendingUp, X, CheckCircle2 } from 'lucide-react';

interface Alert {
  id: string;
  type: 'report_spike' | 'user_surge' | 'payment_failure';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  dismissed: boolean;
  timestamp: string;
}

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({
    reportsToday: 0,
    reports7dAvg: 0,
    newUsersToday: 0,
    newUsers7dAvg: 0,
    failedTransactions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlertData();
  }, []);

  const fetchAlertData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch reports today
      const { count: reportsToday } = await supabase
        .from('content_reports')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart);

      // Fetch reports last 7 days
      const { count: reports7d } = await supabase
        .from('content_reports')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo);

      // Fetch new users today
      const { count: usersToday } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart);

      // Fetch new users last 7 days
      const { count: users7d } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo);

      // Fetch failed coin transactions (negative balance_after could indicate issues)
      const { count: failedTx } = await supabase
        .from('coin_transactions')
        .select('*', { count: 'exact', head: true })
        .lt('balance_after', 0);

      const r7dAvg = Math.round((reports7d || 0) / 7);
      const u7dAvg = Math.round((users7d || 0) / 7);
      const rToday = reportsToday || 0;
      const uToday = usersToday || 0;
      const fTx = failedTx || 0;

      setStats({
        reportsToday: rToday,
        reports7dAvg: r7dAvg,
        newUsersToday: uToday,
        newUsers7dAvg: u7dAvg,
        failedTransactions: fTx,
      });

      // Generate alerts based on data
      const generated: Alert[] = [];

      if (rToday > r7dAvg * 2 && r7dAvg > 0) {
        generated.push({
          id: 'report-spike',
          type: 'report_spike',
          title: 'Report Spike Detected',
          description: `${rToday} reports today vs ${r7dAvg} daily average — ${Math.round((rToday / r7dAvg) * 100)}% above normal`,
          severity: rToday > r7dAvg * 5 ? 'critical' : 'high',
          dismissed: false,
          timestamp: now.toISOString(),
        });
      }

      if (uToday > u7dAvg * 3 && u7dAvg > 0) {
        generated.push({
          id: 'user-surge',
          type: 'user_surge',
          title: 'User Registration Surge',
          description: `${uToday} new users today vs ${u7dAvg} daily average`,
          severity: 'medium',
          dismissed: false,
          timestamp: now.toISOString(),
        });
      }

      if (fTx > 0) {
        generated.push({
          id: 'payment-failure',
          type: 'payment_failure',
          title: 'Negative Balance Transactions',
          description: `${fTx} transactions resulted in negative balances — investigate possible issues`,
          severity: fTx > 10 ? 'high' : 'medium',
          dismissed: false,
          timestamp: now.toISOString(),
        });
      }

      // Pending reports alert
      const { count: pendingReports } = await supabase
        .from('content_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if ((pendingReports || 0) > 10) {
        generated.push({
          id: 'pending-reports',
          type: 'report_spike',
          title: 'Unresolved Reports Backlog',
          description: `${pendingReports} reports are still pending review`,
          severity: (pendingReports || 0) > 50 ? 'critical' : 'high',
          dismissed: false,
          timestamp: now.toISOString(),
        });
      }

      setAlerts(generated);
    } catch (err) {
      console.error('Error fetching alert data:', err);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
  };

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const activeAlerts = alerts.filter((a) => !a.dismissed);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <SerkleLoader size="md" className="text-current" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alerts Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time system health & anomaly detection</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reports Today</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reportsToday}</div>
            <p className="text-xs text-muted-foreground">7-day avg: {stats.reports7dAvg}/day</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New Users Today</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newUsersToday}</div>
            <p className="text-xs text-muted-foreground">7-day avg: {stats.newUsers7dAvg}/day</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Transactions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failedTransactions}</div>
            <p className="text-xs text-muted-foreground">Negative balance entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Alerts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">{alerts.filter(a => a.dismissed).length} dismissed</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Feed */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Live Alerts</h2>
        {activeAlerts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
              <p className="text-foreground font-medium">All Clear</p>
              <p className="text-muted-foreground text-sm">No active alerts — everything looks healthy</p>
            </CardContent>
          </Card>
        ) : (
          activeAlerts.map((alert) => (
            <Card key={alert.id} className="border-l-4" style={{ borderLeftColor: alert.severity === 'critical' ? 'hsl(var(--destructive))' : alert.severity === 'high' ? '#f97316' : '#eab308' }}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{alert.title}</span>
                    <Badge className={severityColor(alert.severity)} variant="outline">
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => dismissAlert(alert.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Button variant="outline" onClick={fetchAlertData}>Refresh Alerts</Button>
    </div>
  );
}
