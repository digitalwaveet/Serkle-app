import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Radio, Search, Users, Eye, Clock, XCircle, BarChart3, AlertTriangle, Activity, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface LiveStream {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  viewer_count: number;
  peak_viewers: number;
  started_at: string;
  ended_at: string | null;
  circle_id: string | null;
  thumbnail_url: string | null;
  broadcaster?: { name: string; username: string; avatar_url: string | null; initials: string; avatar_color: string; is_verified: boolean };
}

export default function AdminLiveStreams() {
  const { logAction } = useAdminAudit();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [pastStreams, setPastStreams] = useState<LiveStream[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ liveNow: 0, totalToday: 0, peakViewers: 0, totalViewMinutes: 0 });

  const fetchStreams = async () => {
    setLoading(true);
    const { data: live } = await supabase
      .from('live_streams')
      .select('*, broadcaster:profiles!live_streams_user_id_fkey(name, username, avatar_url, initials, avatar_color, is_verified)')
      .eq('status', 'live')
      .order('started_at', { ascending: false });

    const { data: ended } = await supabase
      .from('live_streams')
      .select('*, broadcaster:profiles!live_streams_user_id_fkey(name, username, avatar_url, initials, avatar_color, is_verified)')
      .eq('status', 'ended')
      .order('ended_at', { ascending: false })
      .limit(50);

    setStreams((live || []) as unknown as LiveStream[]);
    setPastStreams((ended || []) as unknown as LiveStream[]);

    const liveCount = live?.length || 0;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from('live_streams')
      .select('id', { count: 'exact', head: true })
      .gte('started_at', todayStart.toISOString());

    const peak = Math.max(0, ...(live || []).map((s: any) => s.peak_viewers || 0), ...(ended || []).map((s: any) => s.peak_viewers || 0));

    setStats({ liveNow: liveCount, totalToday: todayCount || 0, peakViewers: peak, totalViewMinutes: 0 });
    setLoading(false);
  };

  useEffect(() => { fetchStreams(); }, []);

  const handleEndStream = async (stream: LiveStream) => {
    const { error } = await supabase
      .from('live_streams')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', stream.id);

    if (error) { toast.error('Failed to end stream'); return; }
    await logAction('stream_ended', 'live_stream', stream.id, { title: stream.title, broadcaster: stream.broadcaster?.name });
    toast.success('Stream ended');
    fetchStreams();
  };

  const filterStreams = (list: LiveStream[]) =>
    list.filter(s =>
      !search || s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.broadcaster?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.broadcaster?.username?.toLowerCase().includes(search.toLowerCase())
    );

  const statusBadge = (status: string) => {
    if (status === 'live') return <Badge className="bg-destructive text-destructive-foreground animate-pulse">● LIVE</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = { audio: 'bg-purple-500/10 text-purple-600', video: 'bg-blue-500/10 text-blue-600', screen: 'bg-green-500/10 text-green-600' };
    return <Badge variant="outline" className={colors[type] || ''}>{type}</Badge>;
  };

  const StreamRow = ({ stream, showActions }: { stream: LiveStream; showActions: boolean }) => (
    <TableRow key={stream.id}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={stream.broadcaster?.avatar_url || undefined} />
            <AvatarFallback style={{ backgroundColor: stream.broadcaster?.avatar_color || '#888' }} className="text-xs text-white">
              {stream.broadcaster?.initials || '??'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm text-foreground">{stream.broadcaster?.name || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">@{stream.broadcaster?.username}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-[200px]">
          <p className="font-medium text-sm truncate text-foreground">{stream.title || 'Untitled'}</p>
          {stream.description && <p className="text-xs text-muted-foreground truncate">{stream.description}</p>}
        </div>
      </TableCell>
      <TableCell>{typeBadge(stream.type)}</TableCell>
      <TableCell>{statusBadge(stream.status)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <Eye className="size-3.5 text-muted-foreground" />
          <span className="text-foreground">{stream.viewer_count}</span>
          <span className="text-xs text-muted-foreground">/ {stream.peak_viewers} peak</span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(stream.started_at), { addSuffix: true })}
      </TableCell>
      {showActions && (
        <TableCell>
          <Button variant="destructive" size="sm" onClick={() => handleEndStream(stream)}>
            <XCircle className="size-3.5 mr-1" /> End
          </Button>
        </TableCell>
      )}
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Live Stream Oversight</h1>
        <p className="text-muted-foreground">Monitor active streams, manage broadcasters, and review analytics.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><Radio className="size-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.liveNow}</p>
                <p className="text-xs text-muted-foreground">Live Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Activity className="size-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalToday}</p>
                <p className="text-xs text-muted-foreground">Streams Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10"><TrendingUp className="size-5 text-secondary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.peakViewers}</p>
                <p className="text-xs text-muted-foreground">Peak Viewers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10"><Users className="size-5 text-accent-foreground" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{streams.reduce((a, s) => a + s.viewer_count, 0)}</p>
                <p className="text-xs text-muted-foreground">Total Viewers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Search streams or broadcasters..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live" className="gap-1">
            <Radio className="size-3.5" /> Live ({streams.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1">
            <Clock className="size-3.5" /> Past Streams
          </TabsTrigger>
          <TabsTrigger value="broadcasters" className="gap-1">
            <Users className="size-3.5" /> Top Broadcasters
          </TabsTrigger>
        </TabsList>

        {/* Live Streams */}
        <TabsContent value="live">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <SerkleLoader size="sm" className="text-current" />
                </div>
              ) : filterStreams(streams).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Radio className="size-8 mx-auto mb-2 opacity-40" />
                  <p>No active live streams</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Broadcaster</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Viewers</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterStreams(streams).map(s => <StreamRow key={s.id} stream={s} showActions={true} />)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Past Streams */}
        <TabsContent value="past">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <SerkleLoader size="sm" className="text-current" />
                </div>
              ) : filterStreams(pastStreams).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="size-8 mx-auto mb-2 opacity-40" />
                  <p>No past streams found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Broadcaster</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Viewers</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterStreams(pastStreams).map(s => <StreamRow key={s.id} stream={s} showActions={false} />)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Broadcasters */}
        <TabsContent value="broadcasters">
          <Card>
            <CardHeader><CardTitle className="text-base">Top Broadcasters (by peak viewers)</CardTitle></CardHeader>
            <CardContent>
              <TopBroadcasters />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TopBroadcasters() {
  const [broadcasters, setBroadcasters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('live_streams')
        .select('user_id, peak_viewers, title, started_at, broadcaster:profiles!live_streams_user_id_fkey(name, username, avatar_url, initials, avatar_color, is_verified)')
        .order('peak_viewers', { ascending: false })
        .limit(20);

      // Aggregate by user
      const map = new Map<string, any>();
      (data || []).forEach((s: any) => {
        const existing = map.get(s.user_id);
        if (!existing) {
          map.set(s.user_id, { ...s.broadcaster, user_id: s.user_id, streamCount: 1, totalPeakViewers: s.peak_viewers || 0 });
        } else {
          existing.streamCount += 1;
          existing.totalPeakViewers += s.peak_viewers || 0;
        }
      });

      setBroadcasters(Array.from(map.values()).sort((a, b) => b.totalPeakViewers - a.totalPeakViewers).slice(0, 10));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><SerkleLoader size="sm" className="text-current" /></div>;

  if (broadcasters.length === 0) return <p className="text-center text-muted-foreground py-8">No broadcaster data yet</p>;

  return (
    <div className="space-y-3">
      {broadcasters.map((b, i) => (
        <div key={b.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <span className="text-lg font-bold text-muted-foreground w-6 text-center">#{i + 1}</span>
          <Avatar className="size-9">
            <AvatarImage src={b.avatar_url || undefined} />
            <AvatarFallback style={{ backgroundColor: b.avatar_color || '#888' }} className="text-xs text-white">{b.initials || '??'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">{b.name}</p>
            <p className="text-xs text-muted-foreground">@{b.username}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{b.totalPeakViewers} peak</p>
            <p className="text-xs text-muted-foreground">{b.streamCount} streams</p>
          </div>
        </div>
      ))}
    </div>
  );
}
