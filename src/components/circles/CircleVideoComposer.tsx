import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCircleVideos, CircleVideo } from '@/hooks/useCircleVideos';
import { useUpload } from '@/contexts/UploadContext';
import { Progress } from '@/components/ui/progress';
import { useVideoPlaylists } from '@/hooks/useVideoPlaylists';
import { Upload, X, Film, Image as ImageIcon, Coins, Crown, Plus, Check } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
interface CircleVideoComposerProps {
  circleId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  videoToEdit?: any;
}
const CircleVideoComposer: React.FC<CircleVideoComposerProps> = ({
  circleId,
  isOpen,
  onOpenChange,
  videoToEdit
}) => {
  const { uploadVideo, updateVideo } = useCircleVideos(circleId);
  const { data: playlists, createPlaylist } = useVideoPlaylists(circleId);
  const { uploads } = useUpload();
  
  // Find if there's an active upload for this circle/video
  const activeUpload = Object.values(uploads).find(u => u.circleId === circleId && u.status === 'uploading');

  const isEditing = !!videoToEdit;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [price, setPrice] = useState('50');
  const [playlistId, setPlaylistId] = useState<string | undefined>(undefined);
  
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>();
  useEffect(() => {
    if (!videoFile) { setVideoPreviewUrl(undefined); return; }
    const url = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIsPremium(false);
    setPrice('50');
    setPlaylistId(undefined);
    setVideoFile(null);
    setThumbnailFile(null);
    setIsCreatingPlaylist(false);
    setNewPlaylistName('');
  };
  useEffect(() => {
    if (isOpen) {
      if (videoToEdit) {
        setTitle(videoToEdit.title || '');
        setDescription(videoToEdit.description || '');
        setIsPremium(videoToEdit.is_premium || false);
        setPrice(String(videoToEdit.price || '50'));
        setPlaylistId(videoToEdit.playlist_id || undefined);
        setVideoFile(null);
        setThumbnailFile(null);
      } else {
        resetForm();
      }
    }
  }, [isOpen, videoToEdit]);

  const { user } = useUser();
  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please log in to perform this action.');
      return;
    }
    
    if (isEditing) {
      if (!title) return;
      try {
        await updateVideo.mutateAsync({
          id: videoToEdit.id,
          title,
          description,
          isPremium,
          price: parseInt(price),
          playlistId,
          thumbnailFile: thumbnailFile || undefined,
        });
        onOpenChange(false);
      } catch (error) {
        console.error('Update failed:', error);
      }
      return;
    }

    if (!videoFile || !title) return;
    try {
      await uploadVideo.mutateAsync({
        videoFile,
        thumbnailFile: thumbnailFile || undefined,
        title,
        description,
        isPremium,
        price: parseInt(price),
        playlistId
      });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const playlist = await createPlaylist.mutateAsync({
        name: newPlaylistName.trim()
      });
      setPlaylistId(playlist.id);
      setIsCreatingPlaylist(false);
      setNewPlaylistName('');
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] h-[90vh] sm:h-auto overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Film className="size-6 text-primary" />
            {isEditing ? 'Edit Circle Video' : 'Upload Circle Video'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Make changes to your existing video.' : 'Share a landscape video with your circle members.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Video Selection - Only show for Upload */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>Video File (Landscape)</Label>
              {videoFile ? (
                <div className="relative aspect-video rounded-xl bg-zinc-900 flex items-center justify-center border-2 border-dashed border-primary/50 overflow-hidden">
                  <video src={videoPreviewUrl} preload="metadata" className="w-full h-full object-contain" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 size-8 rounded-full shadow-lg"
                    onClick={() => setVideoFile(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <button
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-zinc-200 hover:border-primary/50 hover:bg-zinc-50 transition-all flex flex-col items-center justify-center gap-3 text-zinc-400 group"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <div className="p-4 rounded-full bg-zinc-100 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Upload className="size-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-600">Click to select video</p>
                    <p className="text-xs">MP4, WebM (Max 50MB)</p>
                  </div>
                </button>
              )}
              <input
                type="file"
                ref={videoInputRef}
                className="hidden"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              />
            </div>
          )}
          
          {isEditing && videoToEdit.thumbnail_url && !thumbnailFile && (
            <div className="space-y-2">
              <Label>Current Thumbnail</Label>
              <div className="relative aspect-video rounded-xl bg-zinc-900 overflow-hidden border border-zinc-200">
                <img src={videoToEdit.thumbnail_url} className="w-full h-full object-cover" />
              </div>
            </div>
          )}
          {/* Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter an catchy title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="Tell your members about this video..."
                className="resize-none h-24"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Playlist (Optional)</Label>
                {isCreatingPlaylist ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                    <Input
                      placeholder="Playlist name..."
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      autoFocus
                      className="h-10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreatePlaylist();
                        if (e.key === 'Escape') setIsCreatingPlaylist(false);
                      }}
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="size-10 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0"
                      onClick={handleCreatePlaylist}
                      disabled={createPlaylist.isPending}
                    >
                      {createPlaylist.isPending ? <SerkleLoader size="xs" className="text-current" /> : <Check className="size-4" />}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="size-10 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 shrink-0"
                      onClick={() => setIsCreatingPlaylist(false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Select value={playlistId} onValueChange={(val) => {
                    if (val === 'create-new') {
                      setIsCreatingPlaylist(true);
                    } else {
                      setPlaylistId(val);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Playlist" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create-new" className="text-primary font-medium focus:bg-primary/5 focus:text-primary">
                        <div className="flex items-center gap-2">
                          <Plus className="size-4" />
                          <span>Create New Playlist</span>
                        </div>
                      </SelectItem>
                      {playlists && playlists.length > 0 && (
                        <div className="h-px bg-zinc-100 my-1" />
                      )}
                      {playlists?.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 relative overflow-hidden"
                  onClick={() => thumbInputRef.current?.click()}
                >
                  <ImageIcon className="size-4 text-purple-500" />
                  <span className="truncate">{thumbnailFile ? thumbnailFile.name : 'Select Image'}</span>
                </Button>
                <input
                  type="file"
                  ref={thumbInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            {/* Price Component */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-1.5">
                    <Crown className="size-4 text-yellow-500 fill-current" />
                    Paid Access
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Require coins to unlock this video</p>
                </div>
                <Switch checked={isPremium} onCheckedChange={setIsPremium} />
              </div>
              {isPremium && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="relative flex-1">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-yellow-500" />
                    <Input
                      type="number"
                      className="pl-9 h-11 text-lg font-bold"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                  <span className="text-sm font-medium text-zinc-500">Coins</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row gap-3 pt-2">
          {activeUpload ? (
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-primary">
                <span className="inline-flex items-center gap-2"><SerkleLoader size="xs" />Uploading to background...</span>
                <span>{Math.round(activeUpload.progress)}%</span>
              </div>
              <Progress value={activeUpload.progress} className="h-2" />
              <Button 
                variant="ghost" 
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
              >
                Close this window while it uploads
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="flex-[2] h-12 rounded-xl font-bold bg-primary hover:bg-primary/90"
                disabled={(!isEditing && !videoFile) || !title || uploadVideo.isPending || updateVideo.isPending}
                onClick={() => {
                  handleSubmit();
                  // We don't close immediately here because we want to see the "Publishing..." state for a second
                  // but the global overlay will handle the rest.
                }}
              >
                {uploadVideo.isPending || updateVideo.isPending ? (
                  <>
                    <SerkleLoader size="xs" className="text-current mr-2" />
                    {isEditing ? 'Updating...' : 'Publishing...'}
                  </>
                ) : (
                  isEditing ? 'Save Changes' : 'Publish Video'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default CircleVideoComposer;
