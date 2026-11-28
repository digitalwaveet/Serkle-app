import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleDot, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCircleCount } from '@/lib/circleCountFormat';
import { refreshCircleMembership } from '@/lib/circleMembershipClient';
import { CIRCLE_CATEGORIES, displayCategory } from '@/lib/circleTypes';

const PAGE_SIZE = 25;
type Decision =
  | { kind: 'activity'; circle: { id: string; name: string }; active: boolean }
  | { kind: 'remove'; circle: { id: string; name: string }; memberId: string; memberName: string };

export default function AdminCircles() {
  const { session } = useUser();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'circles', userId] as const;
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [circle, setCircle] = useState<{ id: string; name: string } | null>(null);
  const [circlePage, setCirclePage] = useState(0);
  const [memberPage, setMemberPage] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);

  const circles = useQuery({
    queryKey: [...queryKey, 'directory', search, category, circlePage], enabled: Boolean(userId) && !circle,
    gcTime: 0, networkMode: 'always', retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('list_admin_circles', {
        _search: search || undefined, _category: category === 'all' ? undefined : category, _offset: circlePage * PAGE_SIZE,
      }).abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });

  const members = useQuery({
    queryKey: [...queryKey, 'members', circle?.id, memberPage], enabled: Boolean(userId && circle),
    gcTime: 0, networkMode: 'always', retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('list_admin_circle_members', {
        _circle_id: circle!.id, _offset: memberPage * PAGE_SIZE,
      }).abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });

  const change = useMutation({
    mutationFn: async (request: Decision) => {
      const { error } = request.kind === 'activity'
        ? await supabase.rpc('set_admin_circle_activity', { _circle_id: request.circle.id, _active: request.active })
        : await supabase.rpc('remove_circle_member', { _circle_id: request.circle.id, _user_id: request.memberId });
      if (error) throw error;
      return request;
    },
    onSuccess: async (request) => {
      setDecision(null);
      toast.success(request.kind === 'activity' ? request.active ? 'Circle activated' : 'Circle deactivated' : 'Member removed');
      await queryClient.invalidateQueries({ queryKey });
      await refreshCircleMembership(queryClient);
    },
    onError: (error) => {
      if ('code' in error && error.code === '55000') {
        setDecision(null);
        toast.error('This record has already changed.');
        void queryClient.invalidateQueries({ queryKey });
      } else toast.error('Could not save this Circle change.');
    },
  });

  const current = circle ? members : circles;
  const page = circle ? memberPage : circlePage;
  const setPage = circle ? setMemberPage : setCirclePage;
  const action = decision?.kind === 'activity' ? decision.active ? 'Activate Circle' : 'Deactivate Circle' : 'Remove member';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Circle moderation</h1><p className="mt-1.5 text-sm text-muted-foreground">Find communities and review membership records.</p></header>
      <section className="rounded-2xl border bg-card" aria-label={circle ? 'Circle members' : 'Circle directory'}>
        {circle ? (
          <div className="border-b p-4">
            <Button variant="ghost" className="mb-2 h-10 px-2" onClick={() => setCircle(null)}><ArrowLeft size={16} className="mr-2" />Back to Circles</Button>
            <h2 className="break-words font-semibold">{circle.name}</h2>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 border-b p-4">
            <form className="flex min-w-0 flex-1 basis-56 gap-2" role="search" aria-label="Find a Circle" onSubmit={(event) => { event.preventDefault(); setSearch(input.trim()); setCirclePage(0); }}>
              <Input className="h-11 min-w-0" aria-label="Circle name" placeholder="Search Circle names" value={input} maxLength={100} onChange={(event) => setInput(event.target.value)} />
              <Button type="submit" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Search Circles"><Search size={17} /></Button>
            </form>
            <Select value={category} onValueChange={(value) => { setCategory(value); setCirclePage(0); }}>
              <SelectTrigger className="h-11 w-44" aria-label="Circle category"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{CIRCLE_CATEGORIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {current.isPending && <Skeleton className="m-4 h-28" role="status" aria-label="Loading Circle records" />}
        {current.isError && <div role="alert" className="space-y-2 p-4 text-sm"><p>Could not load {circle ? 'membership records' : 'Circles'}.</p><Button variant="outline" size="sm" onClick={() => void current.refetch()} disabled={current.isFetching}>Retry</Button></div>}
        {current.isSuccess && current.data.length === 0 && <p className="p-9 text-center text-sm text-muted-foreground">{circle ? 'No membership records on this page.' : 'No Circles match these filters.'}</p>}

        {!circle && circles.isSuccess && (
          <ul className="divide-y">
            {circles.data.slice(0, PAGE_SIZE).map((row) => (
              <li key={row.id} className="flex flex-wrap items-start gap-3 p-4 sm:p-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><CircleDot size={17} /></span>
                <div className="min-w-0 flex-1 basis-48">
                  <h3 className="break-words font-semibold">{row.name}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {row.category && <Badge variant="outline">{displayCategory(row.category)}</Badge>}
                    {row.is_private && <Badge variant="outline">Private</Badge>}
                    {row.is_premium && <Badge variant="outline">Premium</Badge>}
                    {!row.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {row.description && <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">{row.description}</p>}
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {row.members_count !== null && <span>{formatCircleCount(row.members_count, 'member')}</span>}
                    {row.posts_count !== null && <span>{formatCircleCount(row.posts_count, 'post')}</span>}
                    {row.events_count !== null && <span>{formatCircleCount(row.events_count, 'event')}</span>}
                    {row.subscription_enabled && row.subscription_price !== null && <span>{row.subscription_price.toLocaleString()} coins/month</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="h-10" onClick={() => { setCircle({ id: row.id, name: row.name }); setMemberPage(0); }}><Users size={16} className="mr-1.5" />Members</Button>
                  <Button variant="ghost" className={`h-10 ${row.is_active ? 'text-destructive' : ''}`} onClick={() => setDecision({ kind: 'activity', active: !row.is_active, circle: row })}>{row.is_active ? 'Deactivate' : 'Activate'}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {circle && members.isSuccess && (
          <ul className="divide-y">
            {members.data.slice(0, PAGE_SIZE).map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="break-words text-sm font-semibold">{member.name || member.username || 'Member'}</p>
                  {member.username && <p className="break-all text-xs text-muted-foreground">@{member.username}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge variant="outline" className="capitalize">{member.is_owner ? 'Owner' : member.role}</Badge><Badge variant="secondary" className="capitalize">{member.status}</Badge></div>
                </div>
                {member.status === 'active' && !member.is_owner && <Button variant="ghost" className="h-10 text-destructive" onClick={() => setDecision({ kind: 'remove', circle, memberId: member.user_id, memberName: member.name || member.username || 'this member' })}>Remove</Button>}
              </li>
            ))}
          </ul>
        )}
        {current.isSuccess && (page > 0 || current.data.length > PAGE_SIZE) && (
          <nav aria-label="Circle results pages" className="flex items-center justify-between gap-2 border-t p-3">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button variant="outline" size="sm" disabled={current.data.length <= PAGE_SIZE} onClick={() => setPage(page + 1)}>Next</Button>
          </nav>
        )}
      </section>

      <Dialog open={decision !== null} onOpenChange={(open) => { if (!open && !change.isPending) setDecision(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{action}?</DialogTitle><DialogDescription>
            {decision?.kind === 'remove' ? `${decision.memberName} will lose membership in ${decision.circle.name}. Billing is managed separately.` : `Change the active status of ${decision?.circle.name ?? 'this Circle'}.`}
          </DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={change.isPending} onClick={() => setDecision(null)}>Cancel</Button>
            <Button variant={decision?.kind === 'activity' && decision.active ? 'default' : 'destructive'} disabled={change.isPending || !decision} onClick={() => { if (decision) change.mutate(decision); }}>{change.isPending ? 'Saving…' : action}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
