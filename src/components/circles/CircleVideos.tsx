import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { useCircleVideos, CircleVideo } from '@/hooks/useCircleVideos';
import CircleEmptyState from './CircleEmptyState';
import { useVideoPlaylists } from '@/hooks/useVideoPlaylists';
import { CircleVideoCard } from './CircleVideoCard';
import CircleVideoPlayer from './CircleVideoPlayer';
import CircleVideoComposer from './CircleVideoComposer';
import { Button } from '@/components/ui/button';
import { Plus, Play, ListVideo, Film, ChevronRight, Search, LayoutGrid, Trash2, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCircleCount } from '@/lib/circleCountFormat';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CircleVideosProps {
  circle: any;
  isOwner: boolean;
}

const CircleVideos: React.FC<CircleVideosProps> = ({ circle, isOwner }) => {
  const { data: videos, isLoading, isError: isAccessError, refetch: retryAccess, unlockVideo, deleteVideo } = useCircleVideos(circle.id);
  const { data: playlists } = useVideoPlaylists(circle.id);
  
  const [selectedVideo, setSelectedVideo] = useState<CircleVideo | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<any>(null);
  const [videoToDelete, setVideoToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'videos' | 'playlists'>('videos');

  const filteredVideos = videos?.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         v.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlaylist = !activePlaylistId || v.playlist_id === activePlaylistId;
    return matchesSearch && matchesPlaylist;
  });

  const handleUnlock = async (video: CircleVideo) => {
    try {
      await unlockVideo.mutateAsync(video.id);
    } catch (error) {
      console.error('Unlock failed:', error);
    }
  };

  const handleEdit = (video: any) => {
    setEditingVideo(video);
    setIsComposerOpen(true);
  };

  const handleDeleteClick = (video: any) => {
    setVideoToDelete(video);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!videoToDelete) return;
    try {
      await deleteVideo.mutateAsync(videoToDelete.id);
      setIsDeleteDialogOpen(false);
      setVideoToDelete(null);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <SerkleLoader size="md" className="text-primary" />
        <p className="text-sm text-muted-foreground">Loading videos...</p>
      </div>
    );
  }

  if (isAccessError) return <div className="p-6 text-center"><p>Could not verify access.</p><Button onClick={() => retryAccess()}>Retry</Button></div>;

  return (
    <div className="py-6 px-4 space-y-8 animate-in fade-in duration-500">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 py-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Film className="size-5 text-primary" />
              Circle Videos
            </h2>
            <p className="text-xs text-muted-foreground">{formatCircleCount(videos?.length || 0, 'video')} available</p>
          </div>
          {isOwner && (
            <Button 
              size="sm" 
              className="rounded-full gap-2 bg-primary hover:bg-primary/90 shadow-lg px-4"
              onClick={() => setIsComposerOpen(true)}
            >
              <Plus className="size-4" />
              Add Video
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Search videos..." 
              className="pl-9 h-11 bg-muted border-none rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Tabs value={viewMode} onValueChange={(val: any) => setViewMode(val)}>
            <TabsList className="bg-muted p-1 h-11 rounded-xl">
              <TabsTrigger value="videos" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Film className="size-4 mr-2" />
                Videos
              </TabsTrigger>
              <TabsTrigger value="playlists" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <LayoutGrid className="size-4 mr-2" />
                Playlists
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {viewMode === 'videos' ? (
        <>
          {/* Playlists Horizontal Scroll */}
          {playlists && playlists.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ListVideo className="size-4" />
                  Quick Filters
                </h3>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                <button 
                  className={cn(
                    "flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-bold transition-all border",
                    !activePlaylistId 
                      ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                      : "bg-card text-muted-foreground border-border hover:border-primary/30"
                  )}
                  onClick={() => setActivePlaylistId(null)}
                >
                  All Videos
                </button>
                {playlists.map(playlist => (
                  <button 
                    key={playlist.id}
                    className={cn(
                      "flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-bold transition-all border whitespace-nowrap",
                      activePlaylistId === playlist.id
                        ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                        : "bg-card text-muted-foreground border-border hover:border-primary/30"
                    )}
                    onClick={() => setActivePlaylistId(playlist.id)}
                  >
                    {playlist.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Videos Grid */}
          <section className="space-y-4">
            {filteredVideos && filteredVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredVideos.map(video => (
                  <CircleVideoCard 
                    key={video.id} 
                    video={video} 
                    isOwner={isOwner}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onClick={setSelectedVideo}
                  />
                ))}
              </div>
            ) : (
              <CircleEmptyState
                icon={Film}
                title={activePlaylistId ? 'This playlist has no videos yet' : 'No Videos Yet'}
                description={activePlaylistId ? 'Videos added to this playlist will show up here.' : 'Upload lessons or highlights for your members to watch.'}
                ownerTitle={activePlaylistId ? 'This playlist has no videos yet' : 'Upload your first video'}
                ownerDescription="Add lessons or highlights for your members to watch."
                isOwner={isOwner}
                actionLabel="Add Video"
                onAction={() => setIsComposerOpen(true)}
              />
            )}
          </section>
        </>
      ) : (
        /* Playlists Grid View */
        <section className="space-y-6">
          {playlists && playlists.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setActivePlaylistId(null);
                  setViewMode('videos');
                }}
                className="group relative aspect-[3/4] rounded-2xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:bg-muted/60 transition-colors"
              >
                <Film className="size-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-bold text-foreground">All Videos</span>
              </button>
              
              {playlists.map(playlist => (
                <button
                  key={playlist.id}
                  onClick={() => {
                    setActivePlaylistId(playlist.id);
                    setViewMode('videos');
                  }}
                  className="group relative aspect-[3/4] rounded-2xl bg-muted overflow-hidden border border-border"
                >
                  {playlist.thumbnail_url ? (
                    <img 
                      src={playlist.thumbnail_url} 
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <ListVideo className="size-10 text-primary/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                    <p className="text-white font-bold text-left line-clamp-1">{playlist.name}</p>
                    <p className="text-white/60 text-[10px] text-left">
                      {formatCircleCount(videos?.filter(v => v.playlist_id === playlist.id).length || 0, 'video')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-muted/40 rounded-3xl border-2 border-dashed border-border">
              <div className="p-4 rounded-full bg-card shadow-sm">
                <ListVideo className="size-10 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">No playlists yet</p>
                <p className="text-sm text-muted-foreground max-w-[200px]">
                  Playlists you create will appear here.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Video Player Overlay */}
      {selectedVideo && (
        <CircleVideoPlayer 
          key={selectedVideo.id}
          video={videos?.find(v => v.id === selectedVideo.id) || selectedVideo} 
          circle={circle}
          onClose={() => setSelectedVideo(null)}
          onUnlock={handleUnlock}
          isUnlocking={unlockVideo.isPending}
          onNext={() => {
            const index = videos?.findIndex(v => v.id === selectedVideo.id);
            if (index !== undefined && videos && index < videos.length - 1) {
              setSelectedVideo(videos[index + 1]);
            }
          }}
          onPrevious={() => {
            const index = videos?.findIndex(v => v.id === selectedVideo.id);
            if (index !== undefined && videos && index > 0) {
              setSelectedVideo(videos[index - 1]);
            }
          }}
        />
      )}

      {/* Upload/Edit Composer Modal */}
      <CircleVideoComposer 
        circleId={circle.id}
        isOpen={isComposerOpen}
        onOpenChange={(open) => {
          setIsComposerOpen(open);
          if (!open) setEditingVideo(null);
        }}
        videoToEdit={editingVideo}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the video "{videoToDelete?.title}". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVideoToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteVideo.isPending}
            >
              {deleteVideo.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CircleVideos;
