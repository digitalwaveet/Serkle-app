import React, { useState, useRef } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { X, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { InlineVideoLoader } from '@/components/ui/VideoLoader';
import { uploadChatMedia } from '@/lib/chatMedia';
import { toast } from 'sonner';

interface MediaPreviewModalProps {
  files: File[];
  mediaType: 'photo' | 'video';
  onClose: () => void;
  onSend: (type: string, url: string, caption: string) => void;
  conversationId: string;
  initialCaption?: string;
  onCaptionConsumed?: () => void;
}

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  files,
  mediaType,
  onClose,
  onSend,
  conversationId,
  initialCaption = '',
  onCaptionConsumed,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caption, setCaption] = useState(initialCaption);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const previews = useRef<string[]>(files.map(f => URL.createObjectURL(f))).current;

  const handleSend = async () => {
    setUploading(true);
    try {
      // Upload all files first, collect URLs
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(Math.round(((i) / files.length) * 100));
        const file = files[i];
        uploadedUrls.push(await uploadChatMedia(conversationId, file, file.name));
      }

      // All uploads succeeded, now send messages
      for (let i = 0; i < uploadedUrls.length; i++) {
        const label = i === 0 && caption.trim()
          ? caption.trim()
          : mediaType === 'photo' ? '📷 Photo' : '🎥 Video';
        onSend(mediaType, uploadedUrls[i], label);
      }

      setProgress(100);
      onCaptionConsumed?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to send ${mediaType}`);
    } finally {
      setUploading(false);
    }
  };

  const currentFile = files[currentIndex];
  const previewUrl = previews[currentIndex];

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 safe-top">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-card/10 transition-colors"
        >
          <X className="h-6 w-6 text-white" />
        </button>
        <span className="text-white/70 text-sm">
          {files.length > 1 ? `${currentIndex + 1} / ${files.length}` : ''}
        </span>
        <div className="w-10" />
      </div>

      {/* Media Preview */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-4">
        {mediaType === 'photo' ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-xl"
          />
        ) : (
          <video
            src={previewUrl}
            controls
            className="max-w-full max-h-full rounded-xl"
            autoPlay
            muted
          />
        )}

        {/* Navigation arrows */}
        {files.length > 1 && currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex(i => i - 1)}
            className="absolute left-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {files.length > 1 && currentIndex < files.length - 1 && (
          <button
            onClick={() => setCurrentIndex(i => i + 1)}
            className="absolute right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {files.length > 1 && (
        <div className="flex gap-2 px-4 py-2 justify-center overflow-x-auto">
          {previews.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                i === currentIndex ? 'border-primary scale-110' : 'border-transparent opacity-60'
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Caption + Send */}
      <div className="px-4 pb-4 safe-bottom">
        {uploading && (
          <div className="mb-3">
            <div className="flex justify-center mb-3"><SerkleLoader size="sm" dark label="Uploading attachments" /></div>
            <div className="h-1 bg-card/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-white/50 text-xs mt-1 text-center">Uploading... {progress}%</p>
          </div>
        )}
        <div className="flex items-end gap-3">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            className="flex-1 bg-card/10 text-white placeholder:text-white/40 rounded-2xl px-4 py-3 text-[15px] border-0 outline-none focus:bg-card/15 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={uploading}
            className="h-12 w-12 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50 shadow-lg"
          >
            {uploading ? (
              <InlineVideoLoader className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5 text-primary-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaPreviewModal;
