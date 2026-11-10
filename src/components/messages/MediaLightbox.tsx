import React, { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "./MessagingDialog";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { MediaItem } from "./MediaGroupMosaic";
import { useChatMediaUrls } from "@/hooks/useChatMediaUrls";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { OriginalImageDownload } from '@/components/ui/OriginalImageDownload';
import { downloadOriginalImage } from '@/lib/imageStorage';
import { toast } from 'sonner';

interface MediaLightboxProps {
  items: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

const MediaLightbox: React.FC<MediaLightboxProps> = ({
  items,
  initialIndex,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const source = items[currentIndex];
  const media = useChatMediaUrls([source.url], source.type === 'video');
  const item = { ...source, url: media.url(source.url) };
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const downloadLock = useRef(false);
  useEffect(() => setFailed(false), [item.url, currentIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < items.length - 1) setCurrentIndex((i) => i + 1);
  }, [currentIndex, items.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  // Swipe handling (only when not zoomed)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx < 0) goNext();
      else goPrev();
    } else if (Math.abs(dy) > 100 && dy > 0) {
      onClose(); // Swipe down to close
    }
    touchStart.current = null;
  };

  const handleDownload = async () => {
    if (downloadLock.current) return;
    downloadLock.current = true; setDownloading(true);
    try { await downloadOriginalImage(source.url); }
    catch { toast.error('Download unavailable. Please check your connection and try again.'); }
    finally { downloadLock.current = false; setDownloading(false); }
  };

  const content = (
    <div
      className="h-full bg-black/95 flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 safe-top z-10">
        <button
          type="button"
          aria-label="Close media viewer"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-card/10 transition-colors active:scale-90"
        >
          <X className="h-6 w-6 text-white" />
        </button>

        {items.length > 1 && (
          <span className="text-white/80 text-sm font-medium">
            {currentIndex + 1} / {items.length}
          </span>
        )}

        {source.type === 'video' ? (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label={downloading ? 'Preparing download' : 'Download original'}
            title="Download original"
            className="p-2 rounded-full hover:bg-card/10 transition-colors active:scale-90"
          >
            <Download className="h-5 w-5 text-white" />
          </button>
        ) : <span className="size-9" aria-hidden="true" />}
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {source.type === 'photo' ? <TransformWrapper key={source.id} initialScale={1} minScale={1} maxScale={5} doubleClick={{ mode: 'toggle', step: 2 }}>
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <OptimizedImage src={source.url} alt={source.caption || 'Shared photo'} size="full" loading="eager"
              className="max-h-full bg-transparent" imageClassName="max-h-full object-contain" style={{ maxHeight: '100%' }} />
          </TransformComponent>
        </TransformWrapper> : !item.url ? (
          media.failed(source.url) ? (
            <button
              type="button"
              onClick={media.retry}
              className="min-h-11 px-4 text-white"
            >
              Attachment unavailable · Retry
            </button>
          ) : (
            <SerkleLoader size="md" dark label="Loading private attachment" />
          )
        ) : failed ? (
          <button
            className="msg-button secondary"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
              media.retry();
            }}
          >
            Media unavailable · Retry
          </button>
        ) : (
          <video
            key={`${item.id}-${attempt}`}
            src={item.url}
            controls
            autoPlay
            playsInline
            onError={() => setFailed(true)}
            className="max-w-full max-h-full"
          />
        )}

        {source.type === 'photo' && (
          <OriginalImageDownload
            key={source.id}
            src={source.url}
            className="bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
          />
        )}

        {/* Desktop nav arrows */}
        {items.length > 1 && currentIndex > 0 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous attachment"
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {items.length > 1 && currentIndex < items.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next attachment"
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Dot indicators for mobile */}
      {items.length > 1 && items.length <= 10 && (
        <div className="flex gap-1.5 justify-center py-3 safe-bottom">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              aria-label={`View attachment ${i + 1}`}
              aria-current={i === currentIndex ? "true" : undefined}
              className="w-11 h-11 grid place-items-center"
            >
              <span
                className={`w-2 h-2 rounded-full ${i === currentIndex ? "bg-white" : "bg-white/40"}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        hideClose
        className="msg-fullscreen"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Media viewer</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default MediaLightbox;
