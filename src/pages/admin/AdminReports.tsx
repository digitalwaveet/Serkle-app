import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Search, Flag, CheckCircle2, XCircle, AlertTriangle, Clock, Eye } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Report {
  id: string;
  content_id: string;
  content_type: string;
  reason: string;
  description: string | null;
  reporter_id: string;
  status: string;
  priority: string | null;
  resolution_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter?: { username: string; name: string };
}

export default function AdminReports() {
  const { logAction } = useAdminAudit();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Resolution dialog
  const [resolving, setResolving] = useState<Report | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionAction, setResolutionAction] = useState<'resolved' | 'dismissed'>('resolved');
  const [submitting, setSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState({ pending: 0, resolved: 0, dismissed: 0, total: 0 });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('content_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (typeFilter !== 'all') query = query.eq('content_type', typeFilter);
    if (reasonFilter !== 'all') query = query.eq('reason', reasonFilter);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching reports:', error);
      setLoading(false);
      return;
    }

    // Fetch reporter profiles
    const reporterIds = [...new Set((data || []).map((r: any) => r.reporter_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, name')
      .in('id', reporterIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const enriched = (data || []).map((r: any) => ({
      ...r,
      reporter: profileMap.get(r.reporter_id),
    }));

    setReports(enriched);
    setLoading(false);
  }, [statusFilter, typeFilter, reasonFilter]);

  const fetchStats = async () => {
    const [pending, resolved, dismissed, total] = await Promise.all([
      supabase.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      supabase.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'dismissed'),
      supabase.from('content_reports').select('*', { count: 'exact', head: true }),
    ]);
    setStats({
      pending: pending.count || 0,
      resolved: resolved.count || 0,
      dismissed: dismissed.count || 0,
      total: total.count || 0,
    });
  };

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [fetchReports]);

  const handleResolve = async () => {
    if (!resolving) return;
    setSubmitting(true);

    const { data: session } = await supabase.auth.getSession();
    const adminId = session.session?.user.id;

    const { error } = await supabase
      .from('content_reports')
      .update({
        status: resolutionAction,
        resolution_notes: resolutionNotes || null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', resolving.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await logAction(`report_${resolutionAction}`, 'content_report', resolving.id, {
        content_type: resolving.content_type,
        reason: resolving.reason,
      });
      toast({ title: `Report ${resolutionAction}` });
      setResolving(null);
      setResolutionNotes('');
      fetchReports();
      fetchStats();
    }
    setSubmitting(false);
  };

  const quickResolve = async (report: Report, action: 'resolved' | 'dismissed') => {
    const { data: session } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('content_reports')
      .update({
        status: action,
        reviewed_by: session.session?.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', report.id);

    if (!error) {
      await logAction(`report_${action}`, 'content_report', report.id);
      toast({ title: `Report ${action}` });
      fetchReports();
      fetchStats();
    }
  };

  const filteredReports = reports.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.reason.toLowerCase().includes(s) ||
      (r.description || '').toLowerCase().includes(s) ||
      r.content_type.toLowerCase().includes(s) ||
      (r.reporter?.name || '').toLowerCase().includes(s)
    );
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30">Pending</Badge>;
      case 'resolved': return <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">Resolved</Badge>;
      case 'dismissed': return <Badge variant="outline" className="bg-muted text-muted-foreground">Dismissed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const reasonBadge = (reason: string) => {
    const colors: Record<string, string> = {
      spam: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      'hate speech': 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
      nudity: 'bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30',
      harassment: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
      violence: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
    };
    return <Badge variant="outline" className={colors[reason.toLowerCase()] || 'bg-muted text-muted-foreground'}>{reason}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Violations</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and resolve content reports</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer" onClick={() => setStatusFilter('pending')}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('resolved')}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Resolved</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.resolved}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('dismissed')}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Dismissed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.dismissed}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('all')}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search reports..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Content type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="post">Post</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="comment">Comment</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Reason" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reasons</SelectItem>
            <SelectItem value="spam">Spam</SelectItem>
            <SelectItem value="hate speech">Hate Speech</SelectItem>
            <SelectItem value="nudity">Nudity</SelectItem>
            <SelectItem value="harassment">Harassment</SelectItem>
            <SelectItem value="violence">Violence</SelectItem>
            <SelectItem value="other">Other</SelectItem>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="hidden md:table-cell">Reporter</TableHead>
                  <TableHead className="hidden lg:table-cell">Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">When</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{report.content_type}</Badge>
                    </TableCell>
                    <TableCell>{reasonBadge(report.reason)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {report.reporter?.name || report.reporter_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                      {report.description || '—'}
                    </TableCell>
                    <TableCell>{statusBadge(report.status)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {report.status === 'pending' ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => quickResolve(report, 'resolved')} title="Resolve">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => quickResolve(report, 'dismissed')} title="Dismiss">
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setResolving(report); setResolutionAction('resolved'); }} title="Review">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {report.reviewed_at ? format(new Date(report.reviewed_at), 'MMM d') : '—'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      {reports.length === 0 ? 'No reports found' : 'No reports match your filters'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      <Dialog open={!!resolving} onOpenChange={() => setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
          </DialogHeader>
          {resolving && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{resolving.content_type}</span></div>
                <div><span className="text-muted-foreground">Reason:</span> {reasonBadge(resolving.reason)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Content ID:</span> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{resolving.content_id}</code></div>
              </div>
              {resolving.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Description:</span>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{resolving.description}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-muted-foreground">Resolution Action:</span>
                <Select value={resolutionAction} onValueChange={(v: any) => setResolutionAction(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved">Resolve (action taken)</SelectItem>
                    <SelectItem value="dismissed">Dismiss (no action needed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Notes (optional):</span>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add resolution notes..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={submitting}>
              {submitting ? 'Saving...' : resolutionAction === 'resolved' ? 'Resolve' : 'Dismiss'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
