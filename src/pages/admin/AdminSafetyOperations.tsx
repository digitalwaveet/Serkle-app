import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Shield, Clock, MapPin, Users, CheckCircle, XCircle, Eye, Search, RefreshCw, Star, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SOSAlert {
  id: string;
  user_id: string;
  sos_type: string;
  sub_category: string | null;
  urgency: string;
  description: string;
  status: string;
  location_address: string | null;
  created_at: string;
  resolved_at: string | null;
  profiles?: { name: string; avatar_url: string | null } | null;
  helper_count?: number;
}

interface HelperProfile {
  user_id: string;
  is_available: boolean | null;
  response_count: number | null;
  completion_count: number | null;
  average_rating: number | null;
  current_streak_days: number | null;
  helper_badge: string | null;
  skills: string[] | null;
  last_active_at: string | null;
  profiles?: { name: string; avatar_url: string | null } | null;
}

interface SOSHelper {
  id: string;
  alert_id: string;
  helper_user_id: string;
  status: string;
  accepted_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  estimated_arrival_minutes: number | null;
  profiles?: { name: string; avatar_url: string | null } | null;
}

export default function AdminSafetyOperations() {
  const { logAction } = useAdminAudit();
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [helpers, setHelpers] = useState<HelperProfile[]>([]);
  const [recentResponses, setRecentResponses] = useState<SOSHelper[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({
    activeAlerts: 0,
    totalResolved: 0,
    totalHelpers: 0,
    avgResponseMin: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch alerts
      const { data: alertsData } = await supabase
        .from('sos_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Fetch profiles for alerts
      if (alertsData && alertsData.length > 0) {
        const userIds = [...new Set(alertsData.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);

        const profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);

        // Fetch helper counts
        const alertIds = alertsData.map(a => a.id);
        const { data: helperCounts } = await supabase
          .from('sos_helpers')
          .select('alert_id')
          .in('alert_id', alertIds);

        const countMap = (helperCounts || []).reduce((acc, h) => {
          acc[h.alert_id] = (acc[h.alert_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        setAlerts(alertsData.map(a => ({
          ...a,
          profiles: profileMap[a.user_id] || null,
          helper_count: countMap[a.id] || 0,
        })));
      } else {
        setAlerts([]);
      }

      // Fetch helper profiles
      const { data: helpersData } = await supabase
        .from('helper_profiles')
        .select('*')
        .order('response_count', { ascending: false })
        .limit(100);

      if (helpersData && helpersData.length > 0) {
        const helperUserIds = helpersData.map(h => h.user_id);
        const { data: hProfiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', helperUserIds);

        const hProfileMap = (hProfiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);

        setHelpers(helpersData.map(h => ({
          ...h,
          profiles: hProfileMap[h.user_id] || null,
        })));
      } else {
        setHelpers([]);
      }

      // Fetch recent responses
      const { data: responsesData } = await supabase
        .from('sos_helpers')
        .select('*')
        .order('accepted_at', { ascending: false })
        .limit(50);

      if (responsesData && responsesData.length > 0) {
        const respUserIds = [...new Set(responsesData.map(r => r.helper_user_id))];
        const { data: rProfiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', respUserIds);

        const rProfileMap = (rProfiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);

        setRecentResponses(responsesData.map(r => ({
          ...r,
          profiles: rProfileMap[r.helper_user_id] || null,
        })));
      } else {
        setRecentResponses([]);
      }

      // Compute stats
      const active = (alertsData || []).filter(a => ['active', 'responding'].includes(a.status)).length;
      const resolved = (alertsData || []).filter(a => a.status === 'resolved').length;
      const totalH = (helpersData || []).length;
      const avgResp = (helpersData || []).reduce((sum, h) => sum + (h.average_response_time_minutes || 0), 0) / (totalH || 1);

      setStats({
        activeAlerts: active,
        totalResolved: resolved,
        totalHelpers: totalH,
        avgResponseMin: Math.round(avgResp),
      });
    } catch (err) {
      console.error('Error fetching safety data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleResolveAlert = async (alert: SOSAlert) => {
    const { error } = await supabase
      .from('sos_alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', alert.id);

    if (error) { toast.error('Failed to resolve alert'); return; }
    await logAction('alert_resolved', 'sos_alert', alert.id, { type: alert.sos_type });
    toast.success('Alert resolved');
    fetchData();
  };

  const handleEscalateAlert = async (alert: SOSAlert) => {
    const { error } = await supabase
      .from('sos_alerts')
      .update({ urgency: 'critical' })
      .eq('id', alert.id);

    if (error) { toast.error('Failed to escalate'); return; }
    await logAction('alert_escalated', 'sos_alert', alert.id, { type: alert.sos_type });
    toast.success('Alert escalated to critical');
    fetchData();
  };

  const urgencyColor = (u: string) => {
    switch (u) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'destructive';
      case 'responding': return 'default';
      case 'resolved': return 'secondary';
      default: return 'outline';
    }
  };

  const filteredAlerts = alerts.filter(a =>
    !search ||
    a.sos_type.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase()) ||
    a.profiles?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredHelpers = helpers.filter(h =>
    !search || h.profiles?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SOS & Safety Operations</h1>
          <p className="text-muted-foreground">Monitor emergencies, manage helpers, and review response analytics</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? <SerkleLoader size="xs" className="mr-2 text-current" label="Refreshing" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.activeAlerts}</p>
              <p className="text-xs text-muted-foreground">Active Alerts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalResolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/50">
              <Users className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalHelpers}</p>
              <p className="text-xs text-muted-foreground">Registered Helpers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Clock className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.avgResponseMin}m</p>
              <p className="text-xs text-muted-foreground">Avg Response</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search alerts, helpers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="incidents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="helpers">Helpers</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
        </TabsList>

        {/* Incidents Tab */}
        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">SOS Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <SerkleLoader size="md" className="text-current" />
                </div>
              ) : filteredAlerts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No incidents found</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Urgency</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Helpers</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAlerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell className="font-medium capitalize">{alert.sos_type.replace(/_/g, ' ')}</TableCell>
                          <TableCell>{alert.profiles?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant={urgencyColor(alert.urgency)} className="capitalize">
                              {alert.urgency}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusColor(alert.status)} className="capitalize">
                              {alert.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {alert.helper_count || 0}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs">
                            {alert.location_address || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(alert.created_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {alert.status !== 'resolved' && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleEscalateAlert(alert)}>
                                    <AlertTriangle className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="default" onClick={() => handleResolveAlert(alert)}>
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Helpers Tab */}
        <TabsContent value="helpers">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Registered Helpers</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <SerkleLoader size="md" className="text-current" />
                </div>
              ) : filteredHelpers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No helpers found</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Helper</TableHead>
                        <TableHead>Badge</TableHead>
                        <TableHead>Responses</TableHead>
                        <TableHead>Completions</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Streak</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHelpers.map((helper) => (
                        <TableRow key={helper.user_id}>
                          <TableCell className="font-medium">{helper.profiles?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            {helper.helper_badge ? (
                              <Badge variant="outline" className="capitalize">{helper.helper_badge}</Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell>{helper.response_count || 0}</TableCell>
                          <TableCell>{helper.completion_count || 0}</TableCell>
                          <TableCell>
                            {helper.average_rating ? (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-primary fill-primary" />
                                {helper.average_rating.toFixed(1)}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {helper.current_streak_days ? (
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-primary" />
                                {helper.current_streak_days}d
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={helper.is_available ? 'default' : 'secondary'}>
                              {helper.is_available ? 'Online' : 'Offline'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {helper.last_active_at
                              ? format(new Date(helper.last_active_at), 'MMM d, HH:mm')
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Responses Tab */}
        <TabsContent value="responses">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Helper Responses</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <SerkleLoader size="md" className="text-current" />
                </div>
              ) : recentResponses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No responses found</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Helper</TableHead>
                        <TableHead>Alert ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>ETA (min)</TableHead>
                        <TableHead>Accepted</TableHead>
                        <TableHead>Arrived</TableHead>
                        <TableHead>Completed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentResponses.map((resp) => (
                        <TableRow key={resp.id}>
                          <TableCell className="font-medium">{resp.profiles?.name || 'Unknown'}</TableCell>
                          <TableCell className="text-xs font-mono">{resp.alert_id.slice(0, 8)}…</TableCell>
                          <TableCell>
                            <Badge variant={resp.status === 'completed' ? 'secondary' : resp.status === 'arrived' ? 'default' : 'outline'} className="capitalize">
                              {resp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{resp.estimated_arrival_minutes ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {resp.accepted_at ? format(new Date(resp.accepted_at), 'MMM d, HH:mm') : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {resp.arrived_at ? format(new Date(resp.arrived_at), 'MMM d, HH:mm') : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {resp.completed_at ? format(new Date(resp.completed_at), 'MMM d, HH:mm') : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
