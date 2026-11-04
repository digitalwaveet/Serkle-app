import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { MediaItem } from './MediaGroupMosaic';
import { useChatMediaUrls } from '@/hooks/useChatMediaUrls';
import { SerkleLoader } from '@/components/ui/SerkleLoader';

interface MediaLightboxProps {
  items: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

const MediaLightbox: React.FC<MediaLightboxProps> = ({ items, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const source = items[currentIndex];
  const media = useChatMediaUrls([source.url]);
  const item = { ...source, url: media.url(source.url) };

  const goNext = useCallback(() => {
    if (currentIndex < items.length - 1) setCurrentIndex(i => i + 1);
  }, [currentIndex, items.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
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

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = item.url;
    link.download = `media-${currentIndex + 1}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const content = (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-fade-in select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 safe-top z-10">
        <button
          type="button"
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

        <button
          type="button"
          onClick={handleDownload}
          disabled={!item.url}
          aria-label="Download attachment"
          className="p-2 rounded-full hover:bg-card/10 transition-colors active:scale-90"
        >
          <Download className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {!item.url ? (
          media.failed(source.url)
            ? <button type="button" onClick={media.retry} className="min-h-11 px-4 text-white">Attachment unavailable · Retry</button>
            : <SerkleLoader size="md" dark label="Loading private attachment" />
        ) : item.type === 'video' ? (
          <video
            key={item.id}
            src={item.url}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full"
          />
        ) : (
          <TransformWrapper
            key={item.id}
            initialScale={1}
            minScale={1}
            maxScale={5}
            doubleClick={{ mode: 'toggle', step: 2 }}
            wheel={{ step: 0.2 }}
            panning={{ velocityDisabled: true }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <img
                src={item.url}
                alt=""
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            </TransformComponent>
          </TransformWrapper>
        )}

        {/* Desktop nav arrows */}
        {items.length > 1 && currentIndex > 0 && (
          <button
            type="button"
            onClick={goPrev}
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {items.length > 1 && currentIndex < items.length - 1 && (
          <button
            type="button"
            onClick={goNext}
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
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? 'bg-card scale-125' : 'bg-card/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default MediaLightbox;
