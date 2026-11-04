import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Brain, Shield, AlertTriangle, Search, ChevronLeft, ChevronRight, Play, CheckCircle, XCircle, Eye, Zap } from 'lucide-react';

interface ModerationResult {
  id: string;
  content_type: string;
  content_id: string;
  content_text: string | null;
  user_id: string | null;
  spam_score: number;
  hate_score: number;
  nsfw_score: number;
  overall_risk: string;
  ai_reasoning: string | null;
  auto_action: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_action: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function AdminAIModeration() {
  const [results, setResults] = useState<ModerationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [reviewFilter, setReviewFilter] = useState<string>('unreviewed');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<ModerationResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const { logAction } = useAdminAudit();

  const fetchResults = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('ai_moderation_results')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (riskFilter !== 'all') query = query.eq('overall_risk', riskFilter);
    if (reviewFilter === 'unreviewed') query = query.is('reviewed_at', null);
    else if (reviewFilter === 'reviewed') query = query.not('reviewed_at', 'is', null);

    const { data, count, error } = await query;
    if (error) console.error(error);
    setResults((data as ModerationResult[]) || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [page, riskFilter, reviewFilter]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const scanRecentPosts = async () => {
    setScanning(true);
    setScanProgress(0);
    try {
      const { data: posts } = await supabase
        .from('posts')
        .select('id, content, user_id')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!posts || posts.length === 0) {
        toast.info('No posts to scan');
        setScanning(false);
        return;
      }

      // Check which posts already have moderation results
      const postIds = posts.map(p => p.id);
      const { data: existing } = await supabase
        .from('ai_moderation_results')
        .select('content_id')
        .in('content_id', postIds);

      const existingIds = new Set(existing?.map(e => e.content_id) || []);
      const unscanned = posts.filter(p => !existingIds.has(p.id) && p.content);

      if (unscanned.length === 0) {
        toast.info('All recent posts already scanned');
        setScanning(false);
        return;
      }

      // Process in batches of 5
      const batchSize = 5;
      let processed = 0;

      for (let i = 0; i < unscanned.length; i += batchSize) {
        const batch = unscanned.slice(i, i + batchSize).map(p => ({
          content_type: 'post',
          content_id: p.id,
          content_text: p.content,
          user_id: p.user_id,
        }));

        const { data, error } = await supabase.functions.invoke('moderate-content', {
          body: { batch },
        });

        if (error) {
          console.error('Scan batch error:', error);
          toast.error('Scan error: ' + error.message);
          break;
        }

        processed += batch.length;
        setScanProgress(Math.round((processed / unscanned.length) * 100));
      }

      toast.success(`Scanned ${processed} posts`);
      await logAction('ai_scan_posts', 'moderation', undefined, { count: processed });
      fetchResults();
    } catch (err) {
      console.error(err);
      toast.error('Scan failed');
    } finally {
      setScanning(false);
      setScanProgress(0);
    }
  };

  const handleReview = async (id: string, action: string) => {
    const { data: session } = await supabase.auth.getSession();
    await supabase.from('ai_moderation_results').update({
      reviewed_by: session.session?.user?.id,
      reviewed_at: new Date().toISOString(),
      review_action: action,
    }).eq('id', id);

    // Apply action to the content
    const item = results.find(r => r.id === id);
    if (item && item.content_type === 'post' && (action === 'hidden' || action === 'removed')) {
      await supabase.from('posts').update({ moderation_status: action }).eq('id', item.content_id);
    }

    await logAction(`ai_review_${action}`, 'moderation', id);
    toast.success(`Marked as ${action}`);
    fetchResults();
    setSelectedItem(null);
  };

  const handleBulkReview = async (action: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const { data: session } = await supabase.auth.getSession();
    await supabase.from('ai_moderation_results').update({
      reviewed_by: session.session?.user?.id,
      reviewed_at: new Date().toISOString(),
      review_action: action,
    }).in('id', ids);

    await logAction(`ai_bulk_review_${action}`, 'moderation', undefined, { count: ids.length });
    toast.success(`${ids.length} items marked as ${action}`);
    setSelected(new Set());
    fetchResults();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map(r => r.id)));
  };

  const getRiskBadge = (risk: string) => {
    const map: Record<string, string> = {
      low: 'bg-green-500/10 text-green-600 border-green-300',
      medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-300',
      high: 'bg-orange-500/10 text-orange-600 border-orange-300',
      critical: 'bg-red-500/10 text-red-600 border-red-300',
    };
    return <Badge variant="outline" className={`text-xs ${map[risk] || ''}`}>{risk}</Badge>;
  };

  const ScoreBar = ({ score, label }: { score: number; label: string }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-muted-foreground">{label}</span>
      <Progress value={score * 100} className="flex-1 h-2" />
      <span className="w-8 text-right font-mono">{(score * 100).toFixed(0)}%</span>
    </div>
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Stats
  const criticalCount = results.filter(r => r.overall_risk === 'critical' && !r.reviewed_at).length;
  const highCount = results.filter(r => r.overall_risk === 'high' && !r.reviewed_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">AI Content Moderation</h1>
        </div>
        <Button onClick={scanRecentPosts} disabled={scanning}>
          {scanning ? <SerkleLoader size="xs" className="text-current mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          {scanning ? 'Scanning...' : 'Scan Recent Posts'}
        </Button>
      </div>

      {scanning && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <SerkleLoader size="xs" className="text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">AI scanning in progress...</p>
                <Progress value={scanProgress} className="mt-2" />
              </div>
              <span className="text-sm font-mono text-muted-foreground">{scanProgress}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total Scanned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">Critical (Unreviewed)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{highCount}</p>
            <p className="text-xs text-muted-foreground">High Risk (Unreviewed)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {results.filter(r => r.reviewed_at).length}
            </p>
            <p className="text-xs text-muted-foreground">Reviewed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Bulk Actions */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center">
          <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Risk Level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risks</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reviewFilter} onValueChange={(v) => { setReviewFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unreviewed">Unreviewed</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          {selected.size > 0 && (
            <div className="flex gap-2">
              <Badge variant="secondary">{selected.size} selected</Badge>
              <Button size="sm" variant="outline" onClick={() => handleBulkReview('approved')}>
                <CheckCircle className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkReview('hidden')}>
                <Eye className="h-3 w-3 mr-1" /> Hide
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkReview('removed')}>
                <XCircle className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === results.length && results.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Content</TableHead>
                <TableHead className="hidden md:table-cell">Scores</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead className="hidden sm:table-cell">Auto Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center"><SerkleLoader label="Loading records" showText /></TableCell></TableRow>
              ) : results.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No moderation results. Click "Scan Recent Posts" to start.</TableCell></TableRow>
              ) : results.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedItem(r)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                  </TableCell>
                  <TableCell>
                    <p className="text-sm truncate max-w-[200px]">{r.content_text || '(empty)'}</p>
                    <p className="text-[10px] text-muted-foreground">{r.content_type} · {format(new Date(r.created_at), 'MMM d, HH:mm')}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="space-y-1 w-40">
                      <ScoreBar score={r.spam_score} label="Spam" />
                      <ScoreBar score={r.hate_score} label="Hate" />
                      <ScoreBar score={r.nsfw_score} label="NSFW" />
                    </div>
                  </TableCell>
                  <TableCell>{getRiskBadge(r.overall_risk)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {r.auto_action ? <Badge variant="outline" className="text-xs">{r.auto_action}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {r.reviewed_at ? (
                      <Badge className="bg-green-500/10 text-green-600 text-xs">{r.review_action}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedItem(r); }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Moderation Detail
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-40 overflow-auto">
                {selectedItem.content_text || '(no text)'}
              </div>

              <div className="space-y-2">
                <ScoreBar score={selectedItem.spam_score} label="Spam" />
                <ScoreBar score={selectedItem.hate_score} label="Hate" />
                <ScoreBar score={selectedItem.nsfw_score} label="NSFW" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Risk:</span>
                {getRiskBadge(selectedItem.overall_risk)}
                {selectedItem.auto_action && (
                  <>
                    <span className="text-sm text-muted-foreground ml-2">Auto:</span>
                    <Badge variant="outline" className="text-xs">{selectedItem.auto_action}</Badge>
                  </>
                )}
              </div>

              {selectedItem.ai_reasoning && (
                <p className="text-sm text-muted-foreground italic">AI: {selectedItem.ai_reasoning}</p>
              )}

              <p className="text-xs text-muted-foreground">
                {selectedItem.content_type} · Scanned {format(new Date(selectedItem.created_at), 'MMM d, yyyy HH:mm')}
              </p>

              {selectedItem.reviewed_at ? (
                <Badge className="bg-green-500/10 text-green-600">
                  Reviewed: {selectedItem.review_action} on {format(new Date(selectedItem.reviewed_at), 'MMM d, HH:mm')}
                </Badge>
              ) : (
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => handleReview(selectedItem.id, 'approved')}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button variant="outline" onClick={() => handleReview(selectedItem.id, 'hidden')}>
                    <Eye className="h-4 w-4 mr-1" /> Hide
                  </Button>
                  <Button variant="destructive" onClick={() => handleReview(selectedItem.id, 'removed')}>
                    <XCircle className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
