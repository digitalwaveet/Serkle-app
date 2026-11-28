import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Megaphone, AlertTriangle, Send, Search, ShieldAlert, Clock, User,
} from 'lucide-react';

interface Warning {
  id: string;
  user_id: string;
  warning_type: string;
  reason: string;
  severity: string;
  created_at: string;
}

interface Broadcast {
  id: string;
  title: string;
  message: string;
  target_audience: string;
  channel: string;
  status: string;
  sent_at: string | null;
  recipient_count?: number | null;
  created_at: string;
}

export default function AdminCommunication() {
  const [tab, setTab] = useState('broadcasts');

  // Broadcasts state
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcAudience, setBcAudience] = useState('all');
  const [bcChannel, setBcChannel] = useState('in_app');
  const [bcLoading, setBcLoading] = useState(false);
  const broadcastRequest = useRef<{ input: string; id: string } | null>(null);

  // Warnings state
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [wUserId, setWUserId] = useState('');
  const [wReason, setWReason] = useState('');
  const [wSeverity, setWSeverity] = useState('low');
  const [wType, setWType] = useState('warning');
  const [wLoading, setWLoading] = useState(false);
  const [searchUser, setSearchUser] = useState('');

  const fetchBroadcasts = async () => {
    const { data } = await supabase
      .from('admin_broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setBroadcasts(data);
  };

  const fetchWarnings = async () => {
    let q = supabase.from('user_warnings').select('*').order('created_at', { ascending: false }).limit(50);
    if (searchUser.trim()) q = q.eq('user_id', searchUser.trim());
    const { data } = await q;
    if (data) setWarnings(data);
  };

  useEffect(() => { fetchBroadcasts(); fetchWarnings(); }, []);

  const sendBroadcast = async () => {
    if (bcLoading || !bcTitle.trim() || !bcMessage.trim()) return;
    const title = bcTitle.trim();
    const message = bcMessage.trim();
    const input = JSON.stringify([title, message, bcAudience, bcChannel]);
    if (broadcastRequest.current?.input !== input) broadcastRequest.current = { input, id: crypto.randomUUID() };
    setBcLoading(true);
    try {
      const { data, error } = await supabase.rpc('send_admin_broadcast', {
        _request_id: broadcastRequest.current.id, _title: title, _message: message, _audience: bcAudience, _channel: bcChannel,
      });
      if (error) throw error;
      broadcastRequest.current = null;
      toast({ title: data === 0 ? 'Broadcast recorded with no matching recipients' : `Broadcast queued for ${data} ${data === 1 ? 'account' : 'accounts'}` });
      setBcTitle(''); setBcMessage('');
      await fetchBroadcasts();
    } catch {
      toast({ title: 'Could not confirm the broadcast', description: 'Retry the same message to check its result.', variant: 'destructive' });
    } finally {
      setBcLoading(false);
    }
  };

  const issueWarning = async () => {
    if (wLoading || !wUserId.trim() || !wReason.trim()) return;
    setWLoading(true);
    try {
      const { error } = await supabase.rpc('issue_admin_warning', { _user_id: wUserId.trim(), _type: wType, _reason: wReason, _severity: wSeverity });
      if (error) throw error;
      toast({ title: 'Warning added to the account inbox' });
      setWUserId(''); setWReason('');
      await fetchWarnings();
    } catch {
      toast({ title: 'Could not issue the warning', variant: 'destructive' });
    } finally {
      setWLoading(false);
    }
  };

  const sevBadge = (s: string) => {
    const map: Record<string, string> = {
      low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      critical: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return map[s] || map.low;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">User Communication</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="broadcasts"><Megaphone className="h-4 w-4 mr-1" />Broadcasts</TabsTrigger>
          <TabsTrigger value="warnings"><ShieldAlert className="h-4 w-4 mr-1" />Warnings & Strikes</TabsTrigger>
        </TabsList>

        <TabsContent value="broadcasts" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">New Broadcast</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Title" value={bcTitle} onChange={e => setBcTitle(e.target.value)} maxLength={120} disabled={bcLoading} />
              <Textarea placeholder="Message body..." value={bcMessage} onChange={e => setBcMessage(e.target.value)} rows={3} maxLength={2000} disabled={bcLoading} />
              <div className="flex gap-3 flex-wrap">
                <Select value={bcAudience} onValueChange={setBcAudience}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="sellers">Sellers</SelectItem>
                    <SelectItem value="helpers">Helpers</SelectItem>
                    <SelectItem value="new_users">New Users (7d)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bcChannel} onValueChange={setBcChannel}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_app">In-App</SelectItem>
                    <SelectItem value="both">In-app and device push</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={sendBroadcast} disabled={bcLoading || !bcTitle.trim() || !bcMessage.trim()}>
                  <Send className="h-4 w-4 mr-1" />Send
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Recent Broadcasts</CardTitle></CardHeader>
            <CardContent>
              {broadcasts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No broadcasts sent yet</p>
              ) : (
                <div className="space-y-3">
                  {broadcasts.map(b => (
                    <div key={b.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">{b.title}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{b.target_audience}</Badge>
                          <Badge variant="outline" className="text-xs">{b.channel}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{b.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{typeof b.recipient_count === 'number' ? `${b.recipient_count.toLocaleString()} inbox ${b.recipient_count === 1 ? 'recipient' : 'recipients'}` : 'Recipient count unavailable'}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(b.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warnings" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Issue Warning</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="User ID (UUID)" value={wUserId} onChange={e => setWUserId(e.target.value)} />
              <Textarea placeholder="Reason for warning..." value={wReason} onChange={e => setWReason(e.target.value)} rows={2} maxLength={2000} />
              <div className="flex gap-3 flex-wrap">
                <Select value={wType} onValueChange={setWType}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="strike">Strike</SelectItem>
                    <SelectItem value="final_warning">Final Warning</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={wSeverity} onValueChange={setWSeverity}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={issueWarning} disabled={wLoading || !wUserId.trim() || !wReason.trim()} variant="destructive">
                  <AlertTriangle className="h-4 w-4 mr-1" />Issue
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Warning History</CardTitle>
                <div className="flex gap-2">
                  <Input placeholder="Filter by User ID" value={searchUser} onChange={e => setSearchUser(e.target.value)} className="w-56" />
                  <Button variant="outline" size="sm" onClick={fetchWarnings}><Search className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {warnings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No warnings issued</p>
              ) : (
                <div className="space-y-3">
                  {warnings.map(w => (
                    <div key={w.id} className="border border-border rounded-lg p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="capitalize text-xs">{w.warning_type}</Badge>
                          <Badge className={`text-xs ${sevBadge(w.severity)}`}>{w.severity}</Badge>
                        </div>
                        <p className="text-sm text-foreground">{w.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <User className="h-3 w-3" />{w.user_id.slice(0, 8)}…
                          <span className="mx-1">·</span>
                          <Clock className="h-3 w-3" />{new Date(w.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
