import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Search, MessageSquare, Trash2, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { formatDistanceToNow, format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MessageRow {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  message_type: string;
  created_at: string;
  deleted_for_everyone: boolean;
  sender?: { username: string; name: string };
}

interface DailyVolume {
  date: string;
  count: number;
}

export default function AdminMessagesOversight() {
  const { logAction } = useAdminAudit();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ totalMessages: 0, totalConversations: 0, todayMessages: 0 });
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[]>([]);

  // Delete dialog
  const [deleting, setDeleting] = useState<MessageRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMessages();
    fetchStats();
    fetchDailyVolume();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, sender_id, conversation_id, message_type, created_at, deleted_for_everyone')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
      return;
    }

    const senderIds = [...new Set((data || []).map((m: any) => m.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, name')
      .in('id', senderIds);

    const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const enriched = (data || []).map((m: any) => ({ ...m, sender: pMap.get(m.sender_id) }));

    setMessages(enriched);
    setLoading(false);
  };

  const fetchStats = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalMsg, totalConv, todayMsg] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    ]);
    setStats({
      totalMessages: totalMsg.count || 0,
      totalConversations: totalConv.count || 0,
      todayMessages: todayMsg.count || 0,
    });
  };

  const fetchDailyVolume = async () => {
    // Get messages from last 14 days grouped by day
    const days: DailyVolume[] = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const dayStart = subDays(now, i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      days.push({ date: format(dayStart, 'MMM d'), count: count || 0 });
    }

    setDailyVolume(days);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);

    const { error } = await supabase
      .from('messages')
      .update({ deleted_for_everyone: true, content: '[Deleted by admin]' })
      .eq('id', deleting.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await logAction('delete_message', 'message', deleting.id, {
        sender_id: deleting.sender_id,
        conversation_id: deleting.conversation_id,
      });
      toast({ title: 'Message deleted for everyone' });
      setDeleting(null);
      fetchMessages();
    }
    setSubmitting(false);
  };

  const filtered = messages.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      m.content.toLowerCase().includes(s) ||
      (m.sender?.name || '').toLowerCase().includes(s) ||
      (m.sender?.username || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Messaging Oversight</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor message volume and moderate conversations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Messages</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalMessages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Conversations</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalConversations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Today</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.todayMessages}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Message Volume (14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <SerkleLoader size="sm" className="text-current" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search messages by content or sender..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Messages Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <SerkleLoader size="md" className="text-current" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sender</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">When</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((msg) => (
                  <TableRow key={msg.id} className={msg.deleted_for_everyone ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="min-w-0">
                        <span className="font-medium text-sm block truncate">{msg.sender?.name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">@{msg.sender?.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-sm truncate">{msg.content}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="text-xs">{msg.message_type}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {!msg.deleted_for_everyone ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(msg)}
                          title="Delete for everyone"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Deleted</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      No messages found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete Message
            </DialogTitle>
            <DialogDescription>This will mark the message as deleted for all participants.</DialogDescription>
          </DialogHeader>
          {deleting && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">From:</span>{' '}
                <span className="font-medium">{deleting.sender?.name}</span>
              </div>
              <div className="p-3 bg-muted rounded text-sm">{deleting.content}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete for Everyone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
