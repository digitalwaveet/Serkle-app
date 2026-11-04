import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Scale, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Appeal {
  id: string;
  user_id: string;
  appeal_type: string;
  reason: string;
  evidence_urls: string[] | null;
  status: string;
  moderator_id: string | null;
  moderator_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  user_profile?: { username: string; name: string; email: string };
}

export default function AdminAppeals() {
  const { logAction } = useAdminAudit();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  // Review dialog
  const [reviewing, setReviewing] = useState<Appeal | null>(null);
  const [modNotes, setModNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAppeals();
    fetchStats();
  }, [statusFilter]);

  const fetchAppeals = async () => {
    setLoading(true);
    let query = supabase
      .from('appeals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching appeals:', error);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((data || []).map((a: any) => a.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, name, email')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const enriched = (data || []).map((a: any) => ({
      ...a,
      user_profile: profileMap.get(a.user_id),
    }));

    setAppeals(enriched);
    setLoading(false);
  };

  const fetchStats = async () => {
    const [pending, approved, rejected] = await Promise.all([
      supabase.from('appeals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('appeals').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('appeals').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);
    setStats({
      pending: pending.count || 0,
      approved: approved.count || 0,
      rejected: rejected.count || 0,
    });
  };

  const handleReview = async () => {
    if (!reviewing) return;
    setSubmitting(true);

    const { data: session } = await supabase.auth.getSession();
    const adminId = session.session?.user.id;

    const { error } = await supabase
      .from('appeals')
      .update({
        status: reviewAction,
        moderator_id: adminId,
        moderator_notes: modNotes || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', reviewing.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await logAction(`appeal_${reviewAction}`, 'appeal', reviewing.id, {
        user_id: reviewing.user_id,
        appeal_type: reviewing.appeal_type,
      });
      toast({ title: `Appeal ${reviewAction}` });
      setReviewing(null);
      setModNotes('');
      fetchAppeals();
      fetchStats();
    }
    setSubmitting(false);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30">Pending</Badge>;
      case 'approved': return <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">Approved</Badge>;
      case 'rejected': return <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      ban: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
      suspension: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
      content_removal: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
    };
    return <Badge variant="outline" className={colors[type] || 'bg-muted text-muted-foreground'}>{type.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Appeals Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Review user appeals for bans, suspensions, and content removals</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer" onClick={() => setStatusFilter('pending')}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('approved')}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Approved</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('rejected')}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Rejected</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.rejected}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Submitted</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appeals.map((appeal) => (
                  <TableRow key={appeal.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{appeal.user_profile?.name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground ml-1">@{appeal.user_profile?.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>{typeBadge(appeal.appeal_type)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                      {appeal.reason}
                    </TableCell>
                    <TableCell>{statusBadge(appeal.status)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(appeal.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {appeal.status === 'pending' ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-green-600 text-xs" onClick={() => { setReviewing(appeal); setReviewAction('approved'); }}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-destructive text-xs" onClick={() => { setReviewing(appeal); setReviewAction('rejected'); }}>
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReviewing(appeal)}>
                          <FileText className="h-3 w-3 mr-1" /> View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {appeals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      <Scale className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No appeals found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewing} onOpenChange={() => setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Appeal</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">User:</span> <span className="font-medium">{reviewing.user_profile?.name}</span></div>
                <div><span className="text-muted-foreground">Type:</span> {typeBadge(reviewing.appeal_type)}</div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(reviewing.status)}</div>
                <div><span className="text-muted-foreground">Submitted:</span> <span className="text-xs">{format(new Date(reviewing.created_at), 'MMM d, yyyy')}</span></div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">User's Reason:</span>
                <p className="text-sm mt-1 p-3 bg-muted rounded">{reviewing.reason}</p>
              </div>

              {reviewing.evidence_urls && reviewing.evidence_urls.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Evidence ({reviewing.evidence_urls.length} files):</span>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {reviewing.evidence_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                        File {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {reviewing.moderator_notes && reviewing.status !== 'pending' && (
                <div>
                  <span className="text-sm text-muted-foreground">Moderator Notes:</span>
                  <p className="text-sm mt-1 p-3 bg-muted rounded">{reviewing.moderator_notes}</p>
                </div>
              )}

              {reviewing.status === 'pending' && (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Decision:</span>
                    <Select value={reviewAction} onValueChange={(v: any) => setReviewAction(v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve (reinstate user/content)</SelectItem>
                        <SelectItem value="rejected">Reject (uphold decision)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Moderator Notes:</span>
                    <Textarea
                      value={modNotes}
                      onChange={(e) => setModNotes(e.target.value)}
                      placeholder="Explain your decision..."
                      className="mt-1"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              {reviewing?.status === 'pending' ? 'Cancel' : 'Close'}
            </Button>
            {reviewing?.status === 'pending' && (
              <Button
                onClick={handleReview}
                disabled={submitting}
                variant={reviewAction === 'rejected' ? 'destructive' : 'default'}
              >
                {submitting ? 'Saving...' : reviewAction === 'approved' ? 'Approve Appeal' : 'Reject Appeal'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
