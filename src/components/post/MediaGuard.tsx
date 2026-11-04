import React from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useMediaLoader, MediaType } from '@/hooks/useMediaLoader';
import { FileText, AlertCircle, RefreshCw, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import './MediaGuard.css';


import { usePdfThumbnail } from '@/hooks/usePdfThumbnail';

interface MediaGuardItemProps {
  src: string;
  type: MediaType;
  alt?: string;
  className?: string;
  aspectRatio?: string;
  showOverlay?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

export const MediaGuardItem: React.FC<MediaGuardItemProps> = ({
  src,
  type,
  alt = "Media content",
  className,
  aspectRatio = "aspect-[4/5]",
  showOverlay = true,
  onPlay,
  onPause,
  onEnded
}) => {
  const { status, displaySrc, onLoad, onError, retry } = useMediaLoader(src, type);
  const { thumbnailUrl, loading: pdfLoading } = usePdfThumbnail(type === 'pdf' ? src : null);

  // Render Broken State — only reached after the element itself has failed every retry.
  if (status === 'broken' || !src) {
    return (
      <div className={cn("media-guard-container rounded-xl flex flex-col items-center justify-center bg-black/5 dark:bg-white/5", aspectRatio, className)}>
        <div className="media-error-icon mb-3">
          <AlertCircle className="w-10 h-10 text-red-500/50" />
        </div>
        <p className="text-sm font-medium text-foreground/40 mb-4">Media unavailable</p>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            retry();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-300 pointer-events-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-xs font-semibold">Try again</span>
        </button>
      </div>
    );
  }

  // PDFs render a pre-generated thumbnail image; wait for it before mounting the <img>.
  const isPdfAwaitingThumbnail = type === 'pdf' && !thumbnailUrl;
  const finalSrc = type === 'pdf' ? thumbnailUrl ?? undefined : displaySrc;

  // The element is always mounted (so it can drive onLoad/onError); the skeleton
  // is overlaid until the browser reports the media as ready.
  const isPending = status === 'loading' || status === 'retrying' || isPdfAwaitingThumbnail;

  // Render Media
  return (
    <div className={cn("media-guard-container rounded-xl media-fade-in group relative", aspectRatio, className)}>
      {type === 'image' || type === 'pdf' ? (
        finalSrc && (
          <img
            src={finalSrc}
            alt={alt}
            onLoad={onLoad}
            onError={onError}
            className={cn(
              "w-full h-full object-cover rounded-xl transition-opacity duration-300",
              isPending && "opacity-0"
            )}
            loading="lazy"
          />
        )
      ) : (
        <video
          src={finalSrc}
          onLoadedData={onLoad}
          onError={onError}
          className={cn(
            "w-full h-full object-cover rounded-xl transition-opacity duration-300",
            isPending && "opacity-0"
          )}
          muted
          loop
          playsInline
          autoPlay
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
        />
      )}

      {/* Loading skeleton — overlaid, not a replacement, so the element keeps loading underneath. */}
      {isPending && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl">
          <SerkleLoader size="sm" label={isPdfAwaitingThumbnail ? 'Generating preview' : 'Loading media'} showText />
        </div>
      )}

      {/* Media Indicator Overlay */}
      {showOverlay && type === 'pdf' && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-white shadow-xl">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest">PDF</span>
        </div>
      )}

      {showOverlay && type === 'video' && !isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors duration-300">
          <div className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <PlayCircle className="w-8 h-8" />
          </div>
        </div>
      )}
    </div>
  );
};

interface FeedMediaProps {
  post: {
    id: string | number;
    post_type: 'photo' | 'video' | 'pdf' | 'text' | string;
    media_url?: string | null;
    media_urls?: string[] | null;
    content?: string;
  };
  className?: string;
  aspectRatio?: string;
}

export const FeedMedia: React.FC<FeedMediaProps> = ({ 
  post, 
  className,
  aspectRatio = "aspect-[4/5]"
}) => {
  const src = post.post_type === 'pdf' 
    ? (post.media_urls?.[0] || post.media_url) 
    : (post.media_url || post.media_urls?.[0]);

  // For PDF posts: media_urls often contains pre-rendered page images (.webp/.png),
  // not actual .pdf files. Only use 'pdf' type if the source is a real PDF file,
  // otherwise render the pre-rendered image directly.
  const isPdfFile = src ? /\.pdf(\?|$)/i.test(src) : false;
  const type: MediaType = post.post_type === 'pdf' 
    ? (isPdfFile ? 'pdf' : 'image')
    : post.post_type === 'video' 
      ? 'video' 
      : 'image';

  if (!src) return null;

  return (
    <MediaGuardItem 
      src={src} 
      type={type} 
      alt={post.content || "Post media"} 
      className={className}
      aspectRatio={aspectRatio}
    />
  );
};
