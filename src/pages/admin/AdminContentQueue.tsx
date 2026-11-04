import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ClipboardList, CheckCircle, XCircle, Eye, Clock, AlertTriangle,
  ChevronRight, Filter,
} from 'lucide-react';

interface QueueItem {
  id: string;
  content_type: string;
  content_id: string;
  content_preview: string | null;
  reason: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export default function AdminContentQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showResolve, setShowResolve] = useState(false);
  const [resolving, setResolving] = useState<QueueItem | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolveAction, setResolveAction] = useState<'approve' | 'reject'>('approve');
  const { logAction } = useAdminAudit();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('content_review_queue')
      .select('*')
      .order('created_at', { ascending: tab === 'pending' });

    if (tab !== 'all') {
      query = query.eq('status', tab);
    }
    if (priorityFilter !== 'all') {
      query = query.eq('priority', priorityFilter);
    }

    const { data } = await query.limit(50);
    setItems((data as QueueItem[]) || []);
    setLoading(false);
  }, [tab, priorityFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openResolve = (item: QueueItem, action: 'approve' | 'reject') => {
    setResolving(item);
    setResolveAction(action);
    setResolution('');
    setShowResolve(true);
  };

  const handleResolve = async () => {
    if (!resolving) return;
    const { data: session } = await supabase.auth.getSession();
    const adminId = session.session?.user?.id;

    await supabase.from('content_review_queue').update({
      status: resolveAction === 'approve' ? 'approved' : 'rejected',
      resolved_by: adminId,
      resolution_notes: resolution || null,
      resolved_at: new Date().toISOString(),
    }).eq('id', resolving.id);

    // Apply action to actual content
    if (resolveAction === 'reject') {
      if (resolving.content_type === 'post') {
        await supabase.from('posts').update({ moderation_status: 'removed' }).eq('id', resolving.content_id);
      }
    } else if (resolveAction === 'approve') {
      if (resolving.content_type === 'post') {
        await supabase.from('posts').update({ moderation_status: null }).eq('id', resolving.content_id);
      }
    }

    await logAction(`queue_${resolveAction}`, resolving.content_type, resolving.content_id);
    toast.success(`Content ${resolveAction === 'approve' ? 'approved' : 'rejected'}`);
    setShowResolve(false);
    setResolving(null);
    fetchItems();
  };

  const assignToMe = async (item: QueueItem) => {
    const { data: session } = await supabase.auth.getSession();
    await supabase.from('content_review_queue')
      .update({ assigned_to: session.session?.user?.id, status: 'in_review' })
      .eq('id', item.id);
    toast.success('Assigned to you');
    fetchItems();
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;

  const priorityIcon = (p: string) => {
    switch (p) {
      case 'critical': return <AlertTriangle className="h-3 w-3 text-destructive" />;
      case 'high': return <AlertTriangle className="h-3 w-3 text-orange-500" />;
      default: return null;
    }
  };

  const priorityBadge = (p: string) => {
    switch (p) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Content Review Queue</h1>
          {pendingCount > 0 && (
            <Badge variant="destructive">{pendingCount} pending</Badge>
          )}
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_review">In Review</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="md" label="Loading data" /></div>
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No items in this queue.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{priorityIcon(item.priority)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{item.content_type}</Badge>
                          <Badge variant={priorityBadge(item.priority) as any} className="text-[10px]">{item.priority}</Badge>
                          <Badge variant={
                            item.status === 'approved' ? 'default' :
                            item.status === 'rejected' ? 'destructive' :
                            item.status === 'in_review' ? 'secondary' : 'outline'
                          } className="text-[10px]">{item.status}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {item.reason}
                          </span>
                        </div>
                        {item.content_preview && (
                          <p className="text-sm text-foreground mt-1 line-clamp-2">{item.content_preview}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span>{format(new Date(item.created_at), 'MMM d, HH:mm')}</span>
                          {item.resolved_at && (
                            <span>Resolved: {format(new Date(item.resolved_at), 'MMM d, HH:mm')}</span>
                          )}
                          {item.resolution_notes && (
                            <span className="truncate max-w-48">Note: {item.resolution_notes}</span>
                          )}
                        </div>
                      </div>
                      {(item.status === 'pending' || item.status === 'in_review') && (
                        <div className="flex gap-1 shrink-0">
                          {item.status === 'pending' && (
                            <Button variant="outline" size="sm" onClick={() => assignToMe(item)}>
                              <Eye className="h-3 w-3 mr-1" /> Claim
                            </Button>
                          )}
                          <Button variant="default" size="sm" onClick={() => openResolve(item, 'approve')}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => openResolve(item, 'reject')}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve Dialog */}
      <Dialog open={showResolve} onOpenChange={setShowResolve}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === 'approve' ? 'Approve Content' : 'Reject Content'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {resolveAction === 'approve'
              ? 'This content will be restored and marked as approved.'
              : 'This content will be removed and marked as rejected.'}
          </p>
          <Textarea
            placeholder="Resolution notes (optional)"
            value={resolution}
            onChange={e => setResolution(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolve(false)}>Cancel</Button>
            <Button
              variant={resolveAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleResolve}
            >
              {resolveAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
