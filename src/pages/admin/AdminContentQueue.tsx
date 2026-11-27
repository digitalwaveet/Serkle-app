import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ClipboardList, CheckCircle, XCircle, Eye, AlertTriangle, Filter,
} from 'lucide-react';

import type { Tables } from '@/integrations/supabase/types';

type QueueItem = Tables<'content_review_queue'>;
const PAGE_SIZE = 50;

export default function AdminContentQueue() {
  const { session } = useUser();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('pending');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [resolving, setResolving] = useState<QueueItem | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolveAction, setResolveAction] = useState<'approve' | 'reject'>('approve');
  const [saving, setSaving] = useState(false);
  const mutationActive = useRef(false);
  const queue = useQuery({
    queryKey: ['admin', 'content-queue', userId, tab, priorityFilter, page],
    enabled: Boolean(userId),
    gcTime: 0,
    retry: false,
    networkMode: 'always',
    queryFn: async ({ signal }) => {
      let query = supabase.from('content_review_queue')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: tab === 'pending', nullsFirst: false })
        .order('id', { ascending: true });
      if (tab !== 'all') query = query.eq('status', tab);
      if (priorityFilter !== 'all') query = query.eq('priority', priorityFilter);
      const { data, count, error } = await query
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        .abortSignal(signal);
      if (error) throw error;
      if (count === null) throw new Error('Queue count unavailable');
      return { items: data, count };
    },
  });
  const items = queue.isSuccess ? queue.data.items : [];
  const count = queue.isSuccess ? queue.data.count : undefined;
  const lastPage = count === undefined ? undefined : Math.max(0, Math.ceil(count / PAGE_SIZE) - 1);

  useEffect(() => {
    if (lastPage !== undefined && page > lastPage) setPage(lastPage);
  }, [lastPage, page]);

  const refreshQueue = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin', 'content-queue', userId] }),
    queryClient.invalidateQueries({ queryKey: ['admin', 'snapshot', userId] }),
  ]);

  const openResolve = (item: QueueItem, action: 'approve' | 'reject') => {
    setResolving(item);
    setResolveAction(action);
    setResolution('');
  };

  const handleResolve = async () => {
    if (!resolving || mutationActive.current) return;
    mutationActive.current = true;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('resolve_admin_content_review', {
        _item_id: resolving.id,
        _action: resolveAction,
        _notes: resolution.trim() || undefined,
      });
      if (error) {
        if (error.code === '55000') {
          setResolving(null);
          toast.error('This review is no longer open.');
          await refreshQueue();
        } else {
          toast.error(error.code === 'P0002' ? 'The post no longer exists.' : 'Could not save the review decision.');
        }
        return;
      }
      toast.success('Review decision saved');
      setResolving(null);
      setPage(0);
      await refreshQueue();
    } catch {
      toast.error('Could not confirm the review decision. Refresh the queue to check its status.');
    } finally {
      mutationActive.current = false;
      setSaving(false);
    }
  };

  const assignToMe = async (item: QueueItem) => {
    if (!userId || mutationActive.current) return;
    mutationActive.current = true;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('content_review_queue')
        .update({ assigned_to: userId, status: 'in_review' })
        .eq('id', item.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      if (error) {
        toast.error('Could not claim this review.');
        return;
      }
      if (data) toast.success('Assigned to you');
      else toast.error('This review is no longer available to claim.');
      setPage(0);
      await refreshQueue();
    } catch {
      toast.error('Could not confirm the claim. Refresh the queue to check its status.');
    } finally {
      mutationActive.current = false;
      setSaving(false);
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Content Review Queue</h1>
          {count !== undefined && <Badge variant="outline">{count.toLocaleString()} matching</Badge>}
        </div>
        <Select value={priorityFilter} onValueChange={(value) => { setPriorityFilter(value); setPage(0); }}>
          <SelectTrigger className="w-36" aria-label="Filter by priority">
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

      <Tabs value={tab} onValueChange={(value) => { setTab(value); setPage(0); }}>
        <TabsList className="h-auto flex-wrap justify-start" aria-label="Review status">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_review">In Review</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {queue.isPending ? (
            <div className="space-y-3">
              <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="md" label="Loading data" /></div>
            </div>
          ) : queue.isError ? (
            <div role="alert" className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-medium">Could not load the review queue.</p>
              <Button size="sm" variant="outline" disabled={queue.isFetching} onClick={() => void queue.refetch()}>Retry</Button>
              {page > 0 && <Button size="sm" variant="ghost" onClick={() => setPage(0)}>First page</Button>}
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
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="mt-1">{priorityIcon(item.priority)}</div>
                      <div className="min-w-0 flex-1 basis-48">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{item.content_type}</Badge>
                          <Badge variant={priorityBadge(item.priority)} className="text-[10px]">{item.priority}</Badge>
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
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                          {item.created_at && <span>{format(new Date(item.created_at), 'MMM d, HH:mm')}</span>}
                          {item.resolved_at && (
                            <span>Resolved: {format(new Date(item.resolved_at), 'MMM d, HH:mm')}</span>
                          )}
                          {item.resolution_notes && (
                            <span className="truncate max-w-48">Note: {item.resolution_notes}</span>
                          )}
                        </div>
                      </div>
                      {(item.status === 'pending' || item.status === 'in_review') && (
                        <div className="flex flex-wrap gap-1">
                          {item.status === 'pending' && (
                            <Button variant="outline" size="sm" disabled={saving} onClick={() => void assignToMe(item)}>
                              <Eye className="h-3 w-3 mr-1" /> Claim
                            </Button>
                          )}
                          <Button variant="default" size="sm" disabled={saving} onClick={() => openResolve(item, 'approve')}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button variant="destructive" size="sm" disabled={saving} onClick={() => openResolve(item, 'reject')}>
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
          {lastPage !== undefined && lastPage > 0 && (
            <nav aria-label="Review queue pages" className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" size="sm" disabled={page === 0 || saving} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {lastPage + 1}</span>
              <Button variant="outline" size="sm" disabled={page >= lastPage || saving} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </nav>
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve Dialog */}
      <Dialog open={Boolean(resolving)} onOpenChange={(open) => { if (!open && !saving) setResolving(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === 'approve' ? 'Approve review item' : 'Reject review item'}
            </DialogTitle>
            <DialogDescription>
              {resolving?.content_type === 'post'
                ? `This saves the decision and marks the post as ${resolveAction === 'approve' ? 'active' : 'removed'}.`
                : 'This saves the decision for this review item.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Resolution notes"
            placeholder="Resolution notes (optional)"
            value={resolution}
            onChange={e => setResolution(e.target.value)}
            rows={3}
            disabled={saving}
          />
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setResolving(null)}>Cancel</Button>
            <Button
              variant={resolveAction === 'approve' ? 'default' : 'destructive'}
              onClick={() => void handleResolve()}
              disabled={saving}
            >
              {saving ? 'Saving…' : resolveAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
