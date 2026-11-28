import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Flag, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

const PAGE_SIZE = 25;
const statusOptions = [['pending', 'Pending'], ['reviewed', 'In review'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed'], ['all', 'All reports']];
const typeOptions = [['all', 'All content'], ['post', 'Posts'], ['video', 'Videos'], ['comment', 'Comments'], ['user', 'Users']];
const reasonOptions = ['spam', 'hate speech', 'nudity', 'harassment', 'violence', 'other'];
type Report = Pick<Tables<'content_reports'>, 'id' | 'content_id' | 'content_type' | 'reason' | 'description' | 'status' | 'created_at' | 'reviewed_at' | 'resolution_notes' | 'reporter_id'>;

export default function AdminReports() {
  const { session } = useUser();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'reports', userId] as const;
  const [status, setStatus] = useState('pending');
  const [type, setType] = useState('all');
  const [reason, setReason] = useState('all');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Report | null>(null);
  const [decision, setDecision] = useState<'resolved' | 'dismissed'>('resolved');
  const [notes, setNotes] = useState('');

  const reports = useQuery({
    queryKey: [...queryKey, status, type, reason, search, page],
    enabled: Boolean(userId), gcTime: 0, networkMode: 'always', retry: false,
    queryFn: async ({ signal }) => {
      let request = supabase.from('content_reports')
        .select('id,content_id,content_type,reason,description,status,created_at,reviewed_at,resolution_notes,reporter_id', { count: 'exact' })
        .order('created_at', { ascending: false }).order('id', { ascending: false });
      if (status !== 'all') request = request.eq('status', status);
      if (type !== 'all') request = request.eq('content_type', type);
      if (reason !== 'all') request = request.eq('reason', reason);
      if (search) {
        const pattern = `"%${search.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`;
        request = request.or(`reason.ilike.${pattern},description.ilike.${pattern},content_type.ilike.${pattern}`);
      }
      const { data, error, count } = await request.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal);
      if (error) throw error;
      if (count === null) throw new Error('Report count unavailable');
      return { items: data, count };
    },
  });

  const reporter = useQuery({
    queryKey: ['admin', 'reporter', userId, selected?.reporter_id],
    enabled: Boolean(userId && selected?.reporter_id), gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('profiles').select('name,username')
        .eq('id', selected!.reporter_id).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const resolve = useMutation({
    mutationFn: async (report: Report) => {
      const { error } = await supabase.rpc('resolve_admin_report', { _report_id: report.id, _status: decision, _notes: notes || undefined });
      if (error) throw error;
    },
    onSuccess: async () => {
      setSelected(null);
      setPage(0);
      toast.success(decision === 'resolved' ? 'Report resolved' : 'Report dismissed');
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'snapshot', userId] });
    },
    onError: (error) => {
      if ('code' in error && error.code === '55000') {
        setSelected(null);
        setPage(0);
        toast.error('This report is no longer open.');
        void queryClient.invalidateQueries({ queryKey });
      } else toast.error('Could not save the report decision.');
    },
  });

  const isOpen = (report: Report) => report.status === 'pending' || report.status === 'reviewed';
  const data = reports.isSuccess ? reports.data : undefined;
  const resetPage = (set: (value: string) => void) => (value: string) => { set(value); setPage(0); };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Content reports</h1><p className="mt-1.5 text-sm text-muted-foreground">Review submissions and record the outcome.</p></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Report status">
        {statusOptions.map(([value, label]) => (
          <Button key={value} variant={value === status ? 'default' : 'outline'} onClick={() => resetPage(setStatus)(value)} aria-pressed={status === value} className="h-11">{label}</Button>
        ))}
      </div>

      <section className="rounded-2xl border bg-card" aria-label="Report results">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <form className="flex flex-1 basis-56 gap-2" role="search" aria-label="Search reports" onSubmit={(event) => { event.preventDefault(); resetPage(setSearch)(input.trim()); }}>
            <Input className="h-11 min-w-0" aria-label="Search report reasons or descriptions" placeholder="Search reports" maxLength={100} value={input} onChange={(event) => setInput(event.target.value)} />
            <Button className="h-11 w-11 shrink-0" size="icon" variant="outline" aria-label="Search" type="submit"><Search size={17} /></Button>
          </form>
          <Select value={type} onValueChange={resetPage(setType)}><SelectTrigger aria-label="Content type" className="h-11 w-36"><SelectValue /></SelectTrigger><SelectContent>{typeOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          <Select value={reason} onValueChange={resetPage(setReason)}><SelectTrigger aria-label="Report reason" className="h-11 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All reasons</SelectItem>{reasonOptions.map((value) => <SelectItem key={value} className="capitalize" value={value}>{value}</SelectItem>)}</SelectContent></Select>
          {(search || type !== 'all' || reason !== 'all') && <Button variant="ghost" className="h-11" onClick={() => { setInput(''); setSearch(''); setType('all'); setReason('all'); setPage(0); }}>Clear filters</Button>}
        </div>

        {reports.isPending && <Skeleton className="m-4 h-28" role="status" aria-label="Loading reports" />}
        {reports.isError && <div role="alert" className="space-y-2 p-4 text-sm"><p>Could not load content reports.</p><Button size="sm" variant="outline" disabled={reports.isFetching} onClick={() => void reports.refetch()}>Retry</Button>{page > 0 && <Button size="sm" variant="ghost" onClick={() => setPage(0)}>First page</Button>}</div>}
        {data && (data.items.length ? (
          <ul className="divide-y" aria-label={`${data.count.toLocaleString()} matching reports`}>
            {data.items.map((report) => (
              <li key={report.id} className="flex flex-wrap items-start gap-3 p-4 sm:items-center">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><Flag size={16} /></span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="break-words text-sm font-semibold capitalize">{report.reason}</p>
                  {report.description && <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">{report.description}</p>}
                  <p className="mt-1.5 text-xs text-muted-foreground capitalize">{report.content_type} · {new Date(report.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="capitalize">{report.status}</Badge>
                <Button className="h-10" variant="outline" onClick={() => { setSelected(report); setNotes(''); setDecision('resolved'); }}>{isOpen(report) ? 'Review' : 'View decision'}</Button>
              </li>
            ))}
          </ul>
        ) : <p className="p-9 text-center text-sm text-muted-foreground">No reports match these filters.</p>)}
        {data && (page > 0 || data.count > PAGE_SIZE) && (
          <nav className="flex items-center justify-between border-t p-3" aria-label="Report pages">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= data.count} onClick={() => setPage(page + 1)}>Next<ChevronRight size={16} /></Button>
          </nav>
        )}
      </section>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !resolve.isPending) setSelected(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected && isOpen(selected) ? 'Review report' : 'Report decision'}</DialogTitle><DialogDescription>Report about a {selected?.content_type}.</DialogDescription></DialogHeader>
          {selected && <>
            <dl className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Reason</dt><dd className="capitalize">{selected.reason}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Content reference</dt><dd className="break-all font-mono text-xs">{selected.content_id}</dd></div>
              {reporter.data && <div><dt className="text-xs text-muted-foreground">Reported by</dt><dd className="break-words">{reporter.data.name || reporter.data.username}</dd></div>}
              {selected.description && <div><dt className="text-xs text-muted-foreground">Description</dt><dd className="whitespace-pre-wrap break-words">{selected.description}</dd></div>}
              {!isOpen(selected) && <div><dt className="text-xs text-muted-foreground">Recorded outcome</dt><dd className="capitalize">{selected.status}</dd>{selected.resolution_notes && <dd className="whitespace-pre-wrap break-words">{selected.resolution_notes}</dd>}</div>}
            </dl>
            {isOpen(selected) && <div className="space-y-3">
              <Select value={decision} onValueChange={(value: 'resolved' | 'dismissed') => setDecision(value)} disabled={resolve.isPending}>
                <SelectTrigger aria-label="Report decision"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="resolved">Resolve report</SelectItem><SelectItem value="dismissed">Dismiss report</SelectItem></SelectContent>
              </Select>
              <Textarea aria-label="Resolution notes" placeholder="Resolution notes (optional)" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={resolve.isPending} />
            </div>}
            <DialogFooter>
              <Button variant="outline" disabled={resolve.isPending} onClick={() => setSelected(null)}>{isOpen(selected) ? 'Cancel' : 'Close'}</Button>
              {isOpen(selected) && <Button disabled={resolve.isPending} onClick={() => resolve.mutate(selected)}>{resolve.isPending ? 'Saving…' : 'Save decision'}</Button>}
            </DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
