import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { Search, MoreHorizontal, Eye, EyeOff, Trash2, Pin, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PostRow {
  id: string;
  content: string;
  media_url: string | null;
  media_urls: string[] | null;
  moderation_status: string;
  pinned_at: string | null;
  created_at: string;
  user_id: string;
  profiles: { name: string; username: string; avatar_url: string | null; initials: string; avatar_color: string | null } | null;
  post_stats: { likes_count: number; comments_count: number } | null;
}

const PAGE_SIZE = 20;

export default function AdminPosts() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'hidden' | 'removed' | 'flagged'>('all');
  const [selectedPost, setSelectedPost] = useState<PostRow | null>(null);
  const { logAction } = useAdminAudit();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select('id, content, media_url, media_urls, moderation_status, pinned_at, created_at, user_id, profiles(name, username, avatar_url, initials, avatar_color), post_stats(likes_count, comments_count)', { count: 'exact' });

      if (search) {
        query = query.ilike('content', `%${search}%`);
      }

      if (filter !== 'all') {
        query = query.eq('moderation_status', filter);
      }

      query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      setPosts((data as any[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, [search, page, filter]);

  useEffect(() => {
    const timeout = setTimeout(fetchPosts, 300);
    return () => clearTimeout(timeout);
  }, [fetchPosts]);

  const handleModeration = async (postId: string, status: string) => {
    try {
      await supabase.from('posts').update({ moderation_status: status }).eq('id', postId);
      await logAction(`post_${status}`, 'post', postId);
      toast.success(`Post marked as ${status}`);
      fetchPosts();
    } catch {
      toast.error('Action failed');
    }
  };

  const handlePin = async (postId: string, pinned: boolean) => {
    try {
      await supabase.from('posts').update({ pinned_at: pinned ? new Date().toISOString() : null }).eq('id', postId);
      await logAction(pinned ? 'pin_post' : 'unpin_post', 'post', postId);
      toast.success(pinned ? 'Post pinned' : 'Post unpinned');
      fetchPosts();
    } catch {
      toast.error('Action failed');
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: any; label: string }> = {
      active: { variant: 'outline', label: 'Active' },
      hidden: { variant: 'secondary', label: 'Hidden' },
      removed: { variant: 'destructive', label: 'Removed' },
      flagged: { variant: 'default', label: 'Flagged' },
    };
    const s = map[status] || map.active;
    return <Badge variant={s.variant} className="text-xs">{s.label}</Badge>;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Post Moderation</h1>
        <Badge variant="secondary">{totalCount} posts</Badge>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts by content..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-10"
            />
          </div>
          <Select value={filter} onValueChange={(v: any) => { setFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Posts</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
              <SelectItem value="removed">Removed</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Content</TableHead>
                <TableHead className="hidden md:table-cell">Author</TableHead>
                <TableHead className="hidden sm:table-cell">Engagement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><SerkleLoader label="Loading records" showText /></TableCell></TableRow>
              ) : posts.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No posts found</TableCell></TableRow>
              ) : (
                posts.map((post) => (
                  <TableRow key={post.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedPost(post)}>
                    <TableCell>
                      <div className="max-w-[300px]">
                        <p className="text-sm text-foreground truncate">{post.content || '(no text)'}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {post.pinned_at && <Badge className="text-[10px] px-1 bg-primary/10 text-primary">📌 Pinned</Badge>}
                          {post.media_url && <Badge variant="outline" className="text-[10px] px-1">📷 Media</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {post.profiles && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={post.profiles.avatar_url || ''} />
                            <AvatarFallback style={{ backgroundColor: post.profiles.avatar_color || undefined }} className="text-[10px] text-white">
                              {post.profiles.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">@{post.profiles.username}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {post.post_stats ? `${post.post_stats.likes_count}❤ ${post.post_stats.comments_count}💬` : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(post.moderation_status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedPost(post); }}>
                            <Eye className="h-4 w-4 mr-2" /> View
                          </DropdownMenuItem>
                          {post.moderation_status !== 'hidden' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleModeration(post.id, 'hidden'); }}>
                              <EyeOff className="h-4 w-4 mr-2" /> Hide
                            </DropdownMenuItem>
                          )}
                          {post.moderation_status !== 'active' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleModeration(post.id, 'active'); }}>
                              <RotateCcw className="h-4 w-4 mr-2" /> Restore
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePin(post.id, !post.pinned_at); }}>
                            <Pin className="h-4 w-4 mr-2" /> {post.pinned_at ? 'Unpin' : 'Pin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleModeration(post.id, 'removed'); }}>
                            <Trash2 className="h-4 w-4 mr-2" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Post Detail Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Post Details</DialogTitle></DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              {selectedPost.profiles && (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedPost.profiles.avatar_url || ''} />
                    <AvatarFallback style={{ backgroundColor: selectedPost.profiles.avatar_color || undefined }} className="text-white">
                      {selectedPost.profiles.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{selectedPost.profiles.name}</p>
                    <p className="text-xs text-muted-foreground">@{selectedPost.profiles.username} · {format(new Date(selectedPost.created_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                </div>
              )}
              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedPost.content}</p>
              {selectedPost.media_url && (
                <img src={selectedPost.media_url} alt="Post media" className="rounded-lg max-h-64 object-cover w-full" />
              )}
              <div className="flex gap-2">
                {getStatusBadge(selectedPost.moderation_status)}
                {selectedPost.pinned_at && <Badge className="bg-primary/10 text-primary text-xs">📌 Pinned</Badge>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
