import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Zap, Users, FileText, Ban, Trash2, Eye, EyeOff, History, AlertTriangle } from 'lucide-react';

interface BulkLog {
  id: string;
  action_type: string;
  target_type: string;
  target_ids: string[];
  details: any;
  status: string;
  created_at: string;
}

interface UserRow {
  id: string;
  username: string;
  name: string;
  email: string;
  is_banned: boolean;
}

export default function AdminBulkActions() {
  const [targetType, setTargetType] = useState<'users' | 'posts'>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<BulkLog[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>('');
  const [reason, setReason] = useState('');
  const { logAction } = useAdminAudit();

  const searchItems = useCallback(async () => {
    if (!search.trim()) return;
    setLoading(true);
    setSelected(new Set());

    if (targetType === 'users') {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, name, email')
        .or(`username.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(50);
      setUsers((data as unknown as UserRow[]) || []);
    } else {
      const { data } = await supabase
        .from('posts')
        .select('id, content, user_id, created_at, moderation_status')
        .ilike('content', `%${search}%`)
        .limit(50);
      setPosts(data || []);
    }
    setLoading(false);
  }, [search, targetType]);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('bulk_action_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setLogs((data as BulkLog[]) || []);
  }, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const items = targetType === 'users' ? users : posts;
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  };

  const confirmAction = (action: string) => {
    if (selected.size === 0) { toast.error('No items selected'); return; }
    setPendingAction(action);
    setShowConfirm(true);
  };

  const executeAction = async () => {
    setShowConfirm(false);
    const ids = Array.from(selected);
    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const adminId = session.session?.user?.id;

      if (targetType === 'users') {
        if (pendingAction === 'ban') {
          await supabase.from('profiles').update({ is_banned: true } as any).in('id', ids);
        } else if (pendingAction === 'unban') {
          await supabase.from('profiles').update({ is_banned: false } as any).in('id', ids);
        }
      } else {
        if (pendingAction === 'hide') {
          await supabase.from('posts').update({ moderation_status: 'hidden' }).in('id', ids);
        } else if (pendingAction === 'remove') {
          await supabase.from('posts').update({ moderation_status: 'removed' }).in('id', ids);
        } else if (pendingAction === 'restore') {
          await supabase.from('posts').update({ moderation_status: null }).in('id', ids);
        }
      }

      // Log the bulk action
      await supabase.from('bulk_action_logs').insert({
        action_type: pendingAction,
        target_type: targetType,
        target_ids: ids,
        performed_by: adminId,
        details: { reason, count: ids.length },
      });

      await logAction(`bulk_${pendingAction}`, targetType, undefined, { count: ids.length, reason });
      toast.success(`Bulk ${pendingAction} applied to ${ids.length} ${targetType}`);
      setSelected(new Set());
      setReason('');
      searchItems();
      fetchLogs();
    } catch (e) {
      toast.error('Bulk action failed');
    }
    setLoading(false);
  };

  const items = targetType === 'users' ? users : posts;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Zap className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Bulk Operations</h1>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Select value={targetType} onValueChange={(v: any) => { setTargetType(v); setSelected(new Set()); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="users">Users</SelectItem>
                <SelectItem value="posts">Posts</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1 flex gap-2">
              <Input
                placeholder={`Search ${targetType}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchItems()}
              />
              <Button onClick={searchItems} disabled={loading}>Search</Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selected.size === items.length ? 'Deselect All' : `Select All (${items.length})`}
              </Button>
              <Badge variant="secondary">{selected.size} selected</Badge>
              <div className="flex-1" />
              {targetType === 'users' && (
                <>
                  <Button variant="destructive" size="sm" onClick={() => confirmAction('ban')} disabled={selected.size === 0}>
                    <Ban className="h-3 w-3 mr-1" /> Ban
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => confirmAction('unban')} disabled={selected.size === 0}>
                    Unban
                  </Button>
                </>
              )}
              {targetType === 'posts' && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => confirmAction('hide')} disabled={selected.size === 0}>
                    <EyeOff className="h-3 w-3 mr-1" /> Hide
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => confirmAction('remove')} disabled={selected.size === 0}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => confirmAction('restore')} disabled={selected.size === 0}>
                    <Eye className="h-3 w-3 mr-1" /> Restore
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-96 overflow-auto">
              {targetType === 'users' ? users.map(u => (
                <label key={u.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggleSelect(u.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{u.name} <span className="text-muted-foreground">@{u.username}</span></p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {u.is_banned && <Badge variant="destructive" className="text-[10px]">Banned</Badge>}
                </label>
              )) : posts.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{p.content?.substring(0, 120)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'MMM d, yyyy')}</p>
                  </div>
                  {p.moderation_status && (
                    <Badge variant={p.moderation_status === 'removed' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {p.moderation_status}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Recent Bulk Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-4">
              <Button variant="outline" size="sm" onClick={fetchLogs}>Load History</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-sm">
                  <Badge variant="outline" className="text-[10px]">{log.action_type}</Badge>
                  <span className="text-foreground">{log.target_ids.length} {log.target_type}</span>
                  {log.details?.reason && <span className="text-muted-foreground truncate">— {log.details.reason}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{format(new Date(log.created_at), 'MMM d HH:mm')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Bulk {pendingAction}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will {pendingAction} <strong>{selected.size}</strong> {targetType}. This action may be irreversible.
          </p>
          <Textarea
            placeholder="Reason (optional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={executeAction}>
              Confirm {pendingAction} ({selected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
