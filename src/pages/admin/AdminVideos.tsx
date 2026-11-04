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
import { Search, MoreHorizontal, Eye, EyeOff, Trash2, ChevronLeft, ChevronRight, RotateCcw, Play } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  moderation_status: string;
  created_at: string;
  user_id: string;
  profiles: { name: string; username: string; avatar_url: string | null; initials: string; avatar_color: string | null } | null;
  video_stats: { views_count: number; likes_count: number; comments_count: number; shares_count: number } | null;
}

const PAGE_SIZE = 20;

export default function AdminVideos() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'hidden' | 'removed' | 'flagged'>('all');
  const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null);
  const { logAction } = useAdminAudit();

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('videos')
        .select('id, title, description, video_url, thumbnail_url, moderation_status, created_at, user_id, profiles(name, username, avatar_url, initials, avatar_color), video_stats(views_count, likes_count, comments_count, shares_count)', { count: 'exact' });

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (filter !== 'all') {
        query = query.eq('moderation_status', filter);
      }

      query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      setVideos((data as any[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setLoading(false);
    }
  }, [search, page, filter]);

  useEffect(() => {
    const timeout = setTimeout(fetchVideos, 300);
    return () => clearTimeout(timeout);
  }, [fetchVideos]);

  const handleModeration = async (videoId: string, status: string) => {
    try {
      await supabase.from('videos').update({ moderation_status: status }).eq('id', videoId);
      await logAction(`video_${status}`, 'video', videoId);
      toast.success(`Video marked as ${status}`);
      fetchVideos();
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
        <h1 className="text-2xl font-bold text-foreground">Video Management</h1>
        <Badge variant="secondary">{totalCount} videos</Badge>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos by title..."
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
              <SelectItem value="all">All Videos</SelectItem>
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
                <TableHead>Video</TableHead>
                <TableHead className="hidden md:table-cell">Creator</TableHead>
                <TableHead className="hidden sm:table-cell">Stats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><SerkleLoader label="Loading records" showText /></TableCell></TableRow>
              ) : videos.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No videos found</TableCell></TableRow>
              ) : (
                videos.map((video) => (
                  <TableRow key={video.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedVideo(video)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-10 rounded overflow-hidden bg-muted shrink-0">
                          {video.thumbnail_url ? (
                            <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Play className="h-4 w-4 text-muted-foreground" /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{video.title || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(video.created_at), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {video.profiles && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={video.profiles.avatar_url || ''} />
                            <AvatarFallback style={{ backgroundColor: video.profiles.avatar_color || undefined }} className="text-[10px] text-white">
                              {video.profiles.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">@{video.profiles.username}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {video.video_stats
                        ? `${video.video_stats.views_count}👁 ${video.video_stats.likes_count}❤ ${video.video_stats.comments_count}💬`
                        : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(video.moderation_status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedVideo(video); }}>
                            <Eye className="h-4 w-4 mr-2" /> View
                          </DropdownMenuItem>
                          {video.moderation_status !== 'hidden' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleModeration(video.id, 'hidden'); }}>
                              <EyeOff className="h-4 w-4 mr-2" /> Hide
                            </DropdownMenuItem>
                          )}
                          {video.moderation_status !== 'active' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleModeration(video.id, 'active'); }}>
                              <RotateCcw className="h-4 w-4 mr-2" /> Restore
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleModeration(video.id, 'removed'); }}>
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

      {/* Video Detail Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Video Details</DialogTitle></DialogHeader>
          {selectedVideo && (
            <div className="space-y-4">
              {selectedVideo.profiles && (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedVideo.profiles.avatar_url || ''} />
                    <AvatarFallback style={{ backgroundColor: selectedVideo.profiles.avatar_color || undefined }} className="text-white">
                      {selectedVideo.profiles.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{selectedVideo.profiles.name}</p>
                    <p className="text-xs text-muted-foreground">@{selectedVideo.profiles.username}</p>
                  </div>
                </div>
              )}
              <div>
                <p className="font-medium text-foreground">{selectedVideo.title}</p>
                {selectedVideo.description && <p className="text-sm text-muted-foreground mt-1">{selectedVideo.description}</p>}
              </div>
              {/* Inline video player */}
              <video
                src={selectedVideo.video_url}
                controls
                className="w-full rounded-lg max-h-64"
                poster={selectedVideo.thumbnail_url || undefined}
              />
              <div className="flex gap-2 flex-wrap">
                {getStatusBadge(selectedVideo.moderation_status)}
                {selectedVideo.video_stats && (
                  <>
                    <Badge variant="outline" className="text-xs">{selectedVideo.video_stats.views_count} views</Badge>
                    <Badge variant="outline" className="text-xs">{selectedVideo.video_stats.likes_count} likes</Badge>
                    <Badge variant="outline" className="text-xs">{selectedVideo.video_stats.comments_count} comments</Badge>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
