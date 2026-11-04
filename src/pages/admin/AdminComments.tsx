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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Search, Trash2, MessageCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PostComment {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  source: 'post';
  profile?: { username: string; name: string };
}

interface VideoComment {
  id: string;
  content: string;
  created_at: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  source: 'video';
  profile?: { username: string; name: string };
}

type Comment = PostComment | VideoComment;

export default function AdminComments() {
  const { logAction } = useAdminAudit();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'post' | 'video'>('all');
  const [stats, setStats] = useState({ postComments: 0, videoComments: 0, total: 0 });

  // Delete dialog
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);

    const results: Comment[] = [];

    if (sourceFilter === 'all' || sourceFilter === 'post') {
      const { data: postComments } = await supabase
        .from('comments')
        .select('id, content, created_at, post_id, user_id, parent_id')
        .order('created_at', { ascending: false })
        .limit(150);

      if (postComments) {
        const userIds = [...new Set(postComments.map((c: any) => c.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, username, name').in('id', userIds);
        const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        results.push(
          ...postComments.map((c: any) => ({ ...c, source: 'post' as const, profile: pMap.get(c.user_id) }))
        );
      }
    }

    if (sourceFilter === 'all' || sourceFilter === 'video') {
      const { data: videoComments } = await supabase
        .from('video_comments')
        .select('id, content, created_at, video_id, user_id, parent_id')
        .order('created_at', { ascending: false })
        .limit(150);

      if (videoComments) {
        const userIds = [...new Set(videoComments.map((c: any) => c.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, username, name').in('id', userIds);
        const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        results.push(
          ...videoComments.map((c: any) => ({ ...c, source: 'video' as const, profile: pMap.get(c.user_id) }))
        );
      }
    }

    // Sort combined results by created_at desc
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setComments(results);
    setLoading(false);
  }, [sourceFilter]);

  const fetchStats = async () => {
    const [pc, vc] = await Promise.all([
      supabase.from('comments').select('*', { count: 'exact', head: true }),
      supabase.from('video_comments').select('*', { count: 'exact', head: true }),
    ]);
    const postCount = pc.count || 0;
    const videoCount = vc.count || 0;
    setStats({ postComments: postCount, videoComments: videoCount, total: postCount + videoCount });
  };

  useEffect(() => {
    fetchComments();
    fetchStats();
  }, [fetchComments]);

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);

    const table = deleting.source === 'post' ? 'comments' : 'video_comments';
    const { error } = await supabase.from(table).delete().eq('id', deleting.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      const targetId = deleting.source === 'post' ? (deleting as PostComment).post_id : (deleting as VideoComment).video_id;
      await logAction('delete_comment', deleting.source, deleting.id, {
        content_preview: deleting.content.slice(0, 100),
        target_id: targetId,
      });
      toast({ title: 'Comment deleted' });
      setDeleting(null);
      fetchComments();
      fetchStats();
    }
    setSubmitting(false);
  };

  const getContextLink = (comment: Comment) => {
    if (comment.source === 'post') {
      return `/post/${(comment as PostComment).post_id}`;
    }
    return `/video/${(comment as VideoComment).video_id}`;
  };

  const getContextId = (comment: Comment) => {
    if (comment.source === 'post') return (comment as PostComment).post_id;
    return (comment as VideoComment).video_id;
  };

  const filtered = comments.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.content.toLowerCase().includes(s) ||
      (c.profile?.name || '').toLowerCase().includes(s) ||
      (c.profile?.username || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comments Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse and moderate comments across posts and videos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer" onClick={() => setSourceFilter('all')}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setSourceFilter('post')}>
          <CardContent className="py-3 px-4">
            <span className="text-sm text-muted-foreground">Post Comments</span>
            <p className="text-2xl font-bold mt-1">{stats.postComments}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setSourceFilter('video')}>
          <CardContent className="py-3 px-4">
            <span className="text-sm text-muted-foreground">Video Comments</span>
            <p className="text-2xl font-bold mt-1">{stats.videoComments}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search comments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sourceFilter} onValueChange={(v: any) => setSourceFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="post">Post Comments</SelectItem>
            <SelectItem value="video">Video Comments</SelectItem>
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
                  <TableHead>Content</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">When</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((comment) => (
                  <TableRow key={`${comment.source}-${comment.id}`}>
                    <TableCell>
                      <div className="min-w-0">
                        <span className="font-medium text-sm block truncate">{comment.profile?.name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">@{comment.profile?.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="text-sm truncate">{comment.content}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{comment.source}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {comment.parent_id ? (
                        <Badge variant="outline" className="text-xs">Reply</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">Top-level</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => window.open(getContextLink(comment), '_blank')}
                          title="View context"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(comment)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      No comments found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete Comment
            </DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleting && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">By:</span>{' '}
                <span className="font-medium">{deleting.profile?.name}</span>
              </div>
              <div className="p-3 bg-muted rounded text-sm">{deleting.content}</div>
              <div className="text-xs text-muted-foreground">
                On {deleting.source}: <code className="bg-muted px-1 py-0.5 rounded">{getContextId(deleting).slice(0, 12)}...</code>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete Comment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
