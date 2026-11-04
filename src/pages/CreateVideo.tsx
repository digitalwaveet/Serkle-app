import { useState, useRef, useEffect } from "react";
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Video, Image, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useVideoMutations } from "@/hooks/useVideoMutations";
import { generateVideoThumbnail } from "@/lib/videoUtils";
import VideoThumbnailModal from "@/components/VideoThumbnailModal";
import { CustomFilePicker, useFileManager } from "@/components/CustomFilePicker";

const CreateVideo = () => {
  const navigate = useNavigate();
  const { createVideo } = useVideoMutations();
  const videoManager = useFileManager();
  const thumbManager = useFileManager();
  
  const [autoThumbFile, setAutoThumbFile] = useState<File | null>(null);
  const [autoThumbPreview, setAutoThumbPreview] = useState<string>("");
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isVideoThumbModalOpen, setIsVideoThumbModalOpen] = useState(false);

  const videoFileItem = videoManager.files[0];
  const thumbFileItem = thumbManager.files[0];

  // Auto-generate thumbnail when video changes
  useEffect(() => {
    if (videoFileItem && videoFileItem.kind === 'video') {
      const file = videoFileItem.file as File;
      
      if (file.size > 100 * 1024 * 1024) {
        toast.error("Video file size must be less than 100MB");
        videoManager.removeFile(videoFileItem.id);
        return;
      }

      generateVideoThumbnail(file).then(thumb => {
        setAutoThumbFile(new File([thumb.blob], `thumb_${file.name}.jpg`, { type: 'image/jpeg' }));
        setAutoThumbPreview(thumb.url);
      }).catch(err => console.error('Failed to generate automatic thumb:', err));
    } else {
      setAutoThumbFile(null);
      setAutoThumbPreview("");
    }
  }, [videoFileItem]);

  const handleRemoveVideo = () => {
    if (videoFileItem) {
      videoManager.removeFile(videoFileItem.id);
    }
  };

  const handleRemoveThumbnail = () => {
    if (thumbFileItem) {
      thumbManager.removeFile(thumbFileItem.id);
    }
  };

  const handleSubmit = async () => {
    if (!videoFileItem) {
      toast.error("Please select a video file");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (title.length > 100) {
      toast.error("Title must be less than 100 characters");
      return;
    }

    if (description.length > 500) {
      toast.error("Description must be less than 500 characters");
      return;
    }

    setIsUploading(true);

    const tagsArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const result = await createVideo({
      video: videoFileItem.file as File,
      thumbnail: (thumbFileItem?.file as File) || autoThumbFile || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      tags: tagsArray.length > 0 ? tagsArray : undefined
    });

    setIsUploading(false);

    if (result?.success) {
      navigate('/', { state: { feedMode: 'relax' } });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/', { state: { feedMode: 'feed' } })}
              className="p-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Upload Video</h1>
            <Button
              onClick={handleSubmit}
              disabled={!videoFileItem || !title.trim() || isUploading}
              size="sm"
            >
              {isUploading ? <><SerkleLoader size="xs" className="text-current" label="Uploading video" /> Uploading...</> : "Post"}
            </Button>
          </div>
        </header>

        <div className="p-4 space-y-6">
          {/* Video Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Video *</label>
            {!videoFileItem ? (
              <CustomFilePicker manager={videoManager} hideUploadButton hidePreviewList accept="video/*">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                  <Video className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Select a video to upload</p>
                  <p className="text-xs text-muted-foreground">MP4, MOV, AVI, WebM (Max 100MB)</p>
                </div>
              </CustomFilePicker>
            ) : (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  src={videoFileItem.url}
                  controls
                  className="w-full max-h-96"
                  poster={thumbFileItem?.url || autoThumbPreview}
                />
                <div className="absolute top-2 right-2 flex gap-2 z-10">
                  <button
                    onClick={() => setIsVideoThumbModalOpen(true)}
                    className="p-2 bg-primary/80 hover:bg-primary text-white rounded-full backdrop-blur-md transition-colors shadow-lg"
                    title="Edit thumbnail"
                  >
                    <Image className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleRemoveVideo}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Thumbnail (Optional)</label>
            {!thumbFileItem && !autoThumbPreview ? (
              <CustomFilePicker manager={thumbManager} hideUploadButton hidePreviewList accept="image/*">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                  <Image className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Add custom thumbnail</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP</p>
                </div>
              </CustomFilePicker>
            ) : (
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={thumbFileItem?.url || autoThumbPreview}
                  alt="Thumbnail preview"
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-2 z-10">
                  <CustomFilePicker manager={thumbManager} hideUploadButton hidePreviewList accept="image/*">
                    <div className="p-2 bg-primary/80 hover:bg-primary text-white rounded-full backdrop-blur-md transition-colors shadow-lg cursor-pointer">
                      <Image className="w-4 h-4" />
                    </div>
                  </CustomFilePicker>
                  
                  {thumbFileItem && (
                    <button
                      onClick={handleRemoveThumbnail}
                      className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your video a catchy title..."
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground text-right">
              {title.length}/100
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (Optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers what your video is about..."
              maxLength={500}
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/500
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (Optional)</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comedy, dance, tutorial (comma separated)"
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas to help people discover your video
            </p>
          </div>
        </div>
      </div>

      {/* Video Thumbnail Selector Modal */}
      {videoFileItem && (
        <VideoThumbnailModal
          isOpen={isVideoThumbModalOpen}
          onClose={() => setIsVideoThumbModalOpen(false)}
          videoFile={videoFileItem.file as File}
          onSelect={(blob, url) => {
            setAutoThumbFile(new File([blob], `thumb_${videoFileItem.name}.jpg`, { type: 'image/jpeg' }));
            setAutoThumbPreview(url);
            
            // clear custom thumb if they use video modal
            if (thumbFileItem) {
              thumbManager.removeFile(thumbFileItem.id);
            }

            setIsVideoThumbModalOpen(false);
            toast.success('Thumbnail selected successfully');
          }}
        />
      )}
    </div>
  );
};

export default CreateVideo;
