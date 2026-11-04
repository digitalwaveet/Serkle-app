import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Webhook, Plus, Trash2, Edit2, Bell, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

interface AdminNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string | null;
  severity: string;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  { value: 'content.flagged', label: 'Content Flagged' },
  { value: 'content.removed', label: 'Content Removed' },
  { value: 'user.banned', label: 'User Banned' },
  { value: 'user.reported', label: 'User Reported' },
  { value: 'moderation.critical', label: 'Critical Moderation' },
  { value: 'sos.alert', label: 'SOS Alert Created' },
  { value: 'appeal.submitted', label: 'Appeal Submitted' },
];

export default function AdminWebhooks() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const { logAction } = useAdminAudit();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [epRes, notifRes] = await Promise.all([
      supabase.from('webhook_endpoints').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(30),
    ]);
    setEndpoints((epRes.data as WebhookEndpoint[]) || []);
    setNotifications((notifRes.data as AdminNotification[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime admin notifications
  useEffect(() => {
    const channel = supabase
      .channel('admin-notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, (payload) => {
        const n = payload.new as AdminNotification;
        setNotifications(prev => [n, ...prev].slice(0, 30));
        toast.info(n.title, { description: n.message || undefined });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const resetForm = () => {
    setFormName(''); setFormUrl(''); setFormEvents([]);
  };

  const openEdit = (ep: WebhookEndpoint) => {
    setEditing(ep);
    setFormName(ep.name);
    setFormUrl(ep.url);
    setFormEvents(ep.event_types);
    setShowCreate(true);
  };

  const toggleEvent = (evt: string) => {
    setFormEvents(prev => prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formUrl.trim()) { toast.error('Name and URL required'); return; }
    if (formEvents.length === 0) { toast.error('Select at least one event'); return; }

    const { data: session } = await supabase.auth.getSession();
    const payload = {
      name: formName,
      url: formUrl,
      event_types: formEvents,
      created_by: session.session?.user?.id,
    };

    if (editing) {
      await supabase.from('webhook_endpoints').update(payload).eq('id', editing.id);
      await logAction('update_webhook', 'webhook', editing.id);
      toast.success('Webhook updated');
    } else {
      await supabase.from('webhook_endpoints').insert(payload);
      await logAction('create_webhook', 'webhook');
      toast.success('Webhook created');
    }

    setShowCreate(false);
    setEditing(null);
    resetForm();
    fetchAll();
  };

  const toggleEndpoint = async (ep: WebhookEndpoint) => {
    await supabase.from('webhook_endpoints').update({ is_active: !ep.is_active }).eq('id', ep.id);
    await logAction(ep.is_active ? 'disable_webhook' : 'enable_webhook', 'webhook', ep.id);
    toast.success(ep.is_active ? 'Webhook disabled' : 'Webhook enabled');
    fetchAll();
  };

  const deleteEndpoint = async (id: string) => {
    await supabase.from('webhook_endpoints').delete().eq('id', id);
    await logAction('delete_webhook', 'webhook', id);
    toast.success('Webhook deleted');
    fetchAll();
  };

  const markAllRead = async () => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
    fetchAll();
  };

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Notifications & Webhooks</h1>
        </div>
      </div>

      {/* Admin Notifications Feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Admin Alerts
              {notifications.filter(n => !n.is_read).length > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {notifications.filter(n => !n.is_read).length} new
                </Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notifications yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    n.is_read ? 'bg-muted/20' : 'bg-primary/5 border border-primary/10'
                  }`}
                >
                  {n.severity === 'critical' ? (
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  ) : n.severity === 'warning' ? (
                    <XCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <Badge variant={severityColor(n.severity) as any} className="text-[9px]">{n.severity}</Badge>
                    </div>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(n.created_at), 'MMM d HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Endpoints */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Webhook Endpoints</h2>
        <Button size="sm" onClick={() => { resetForm(); setEditing(null); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Endpoint
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="md" label="Loading data" /></div>
        </div>
      ) : endpoints.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No webhook endpoints configured. Add one to receive alerts for critical events.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {endpoints.map(ep => (
            <Card key={ep.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <Switch checked={ep.is_active} onCheckedChange={() => toggleEndpoint(ep)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{ep.name}</p>
                    {ep.failure_count > 0 && (
                      <Badge variant="destructive" className="text-[10px]">{ep.failure_count} failures</Badge>
                    )}
                    {!ep.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{ep.url}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {ep.event_types.map(evt => (
                      <Badge key={evt} variant="outline" className="text-[9px]">{evt}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ep)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteEndpoint(ep.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={() => { setShowCreate(false); setEditing(null); resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Webhook' : 'Add Webhook Endpoint'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Endpoint name" value={formName} onChange={e => setFormName(e.target.value)} />
            <Input placeholder="https://your-server.com/webhook" value={formUrl} onChange={e => setFormUrl(e.target.value)} />
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Event Types</label>
              <div className="space-y-2">
                {EVENT_TYPES.map(evt => (
                  <label key={evt.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formEvents.includes(evt.value)}
                      onCheckedChange={() => toggleEvent(evt.value)}
                    />
                    <span className="text-sm text-foreground">{evt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
