import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshCircleMembership } from '@/lib/circleMembershipClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { formatCircleCount } from '@/lib/circleCountFormat';
import { toast } from '@/hooks/use-toast';
import {
  Users, Search, Eye, Ban, Shield, Crown, Globe, Lock,
  Calendar, FileText, TrendingUp, RefreshCw,
} from 'lucide-react';

interface CircleRow {
  id: string;
  name: string;
  description: string;
  category: string;
  creator_id: string;
  is_private: boolean | null;
  is_premium: boolean | null;
  is_active: boolean | null;
  subscription_enabled: boolean;
  subscription_price: number;
  created_at: string | null;
}

interface CircleStat {
  circle_id: string;
  members_count: number | null;
  posts_count: number | null;
  events_count: number | null;
  resources_count: number | null;
}

interface MemberRow {
  id: string;
  user_id: string;
  circle_id: string;
  role: string;
  status: string;
  joined_at: string | null;
}

export default function AdminCircles() {
  const queryClient = useQueryClient();
  const { logAction } = useAdminAudit();
  const [tab, setTab] = useState('circles');
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [stats, setStats] = useState<Record<string, CircleStat>>({});
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedCircle, setSelectedCircle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCircles = async () => {
    setLoading(true);
    let q = supabase.from('circles').select('*').order('created_at', { ascending: false }).limit(100);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    if (filterCategory !== 'all') q = q.eq('category', filterCategory);

    const { data } = await q;
    if (data) {
      setCircles(data);
      const ids = data.map(c => c.id);
      if (ids.length > 0) {
        const { data: statsData } = await supabase.from('circle_stats').select('*').in('circle_id', ids);
        if (statsData) {
          const map: Record<string, CircleStat> = {};
          statsData.forEach(s => { map[s.circle_id] = s; });
          setStats(map);
        }
      }
    }
    setLoading(false);
  };

  const fetchMembers = async (circleId: string) => {
    setSelectedCircle(circleId);
    const { data } = await supabase.from('circle_members').select('*').eq('circle_id', circleId).order('joined_at', { ascending: false }).limit(100);
    if (data) setMembers(data);
    setTab('members');
  };

  const toggleCircleActive = async (circle: CircleRow) => {
    const newActive = !circle.is_active;
    await supabase.from('circles').update({ is_active: newActive }).eq('id', circle.id);
    await logAction(newActive ? 'circle_reactivated' : 'circle_deactivated', 'circle', circle.id, { name: circle.name });
    toast({ title: newActive ? 'Circle reactivated' : 'Circle deactivated' });
    fetchCircles();
  };

  const removeMember = async (member: MemberRow) => {
    const { error } = await supabase.rpc('remove_circle_member' as any, { _circle_id: member.circle_id, _user_id: member.user_id });
    if (error) { toast({ title: 'Could not remove member', description: error.message, variant: 'destructive' }); return; }
    await refreshCircleMembership(queryClient);
    await logAction('member_removed', 'circle_member', member.id, { circle_id: member.circle_id, user_id: member.user_id });
    toast({ title: 'Member removed' });
    if (selectedCircle) fetchMembers(selectedCircle);
  };

  useEffect(() => { fetchCircles(); }, []);

  const categories = [...new Set(circles.map(c => c.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Circle Moderation</h1>
        <Button variant="outline" size="sm" onClick={fetchCircles} disabled={loading}>
          {loading ? <SerkleLoader size="xs" className="mr-1 text-current" label="Refreshing" /> : <RefreshCw className="h-4 w-4 mr-1" />}Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="circles"><Globe className="h-4 w-4 mr-1" />All Circles</TabsTrigger>
          <TabsTrigger value="members" disabled={!selectedCircle}><Users className="h-4 w-4 mr-1" />Members</TabsTrigger>
        </TabsList>

        <TabsContent value="circles" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search circles..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9"
                onKeyDown={e => e.key === 'Enter' && fetchCircles()} />
            </div>
            <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchCircles}><Search className="h-4 w-4" /></Button>
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{circles.length}</p>
              <p className="text-xs text-muted-foreground">Total Circles</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{circles.filter(c => c.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{circles.filter(c => c.is_premium).length}</p>
              <p className="text-xs text-muted-foreground">Premium</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{circles.filter(c => c.is_private).length}</p>
              <p className="text-xs text-muted-foreground">Private</p>
            </CardContent></Card>
          </div>

          {/* Circle list */}
          <div className="space-y-3">
            {circles.map(circle => {
              const s = stats[circle.id];
              return (
                <Card key={circle.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-foreground">{circle.name}</span>
                          <Badge variant="outline" className="text-xs">{circle.category}</Badge>
                          {circle.is_private && <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-0.5" />Private</Badge>}
                          {circle.is_premium && <Badge className="text-xs bg-primary/10 text-primary border-primary/20"><Crown className="h-3 w-3 mr-0.5" />Premium</Badge>}
                          {!circle.is_active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{circle.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{formatCircleCount(s?.members_count ?? 0, 'member')}</span>
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{formatCircleCount(s?.posts_count ?? 0, 'post')}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatCircleCount(s?.events_count ?? 0, 'event')}</span>
                          {circle.subscription_enabled && (
                            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{circle.subscription_price} coins/mo</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => fetchMembers(circle.id)}>
                          <Eye className="h-4 w-4 mr-1" />Members
                        </Button>
                        <Button variant={circle.is_active ? "destructive" : "default"} size="sm" onClick={() => toggleCircleActive(circle)}>
                          {circle.is_active ? <><Ban className="h-4 w-4 mr-1" />Deactivate</> : <><Shield className="h-4 w-4 mr-1" />Activate</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {circles.length === 0 && !loading && (
              <p className="text-center text-muted-foreground py-8">No circles found</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-4 mt-4">
          {selectedCircle && (
            <>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setTab('circles')}>← Back to circles</Button>
                <span className="text-sm text-muted-foreground">
                  {circles.find(c => c.id === selectedCircle)?.name} · {formatCircleCount(members.length, 'member')}
                </span>
              </div>
              <div className="space-y-2">
                {members.map(m => (
                  <Card key={m.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{m.user_id.slice(0, 8)}…</span>
                          <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                          <Badge variant={m.status === 'active' ? 'secondary' : 'destructive'} className="text-xs">{m.status}</Badge>
                        </div>
                        {m.joined_at && <p className="text-xs text-muted-foreground mt-0.5">Joined {new Date(m.joined_at).toLocaleDateString()}</p>}
                      </div>
                      {m.status === 'active' && m.role !== 'creator' && (
                        <Button variant="destructive" size="sm" onClick={() => removeMember(m)}>Remove</Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {members.length === 0 && <p className="text-center text-muted-foreground py-6">No members</p>}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
