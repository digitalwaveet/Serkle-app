import React, { useState, useRef, useEffect } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Play, Download } from 'lucide-react';
import { useChatMediaUrls } from '@/hooks/useChatMediaUrls';

export interface MediaItem {
  id: string;
  url: string;
  type: 'photo' | 'video';
  caption?: string;
}

interface MediaGroupMosaicProps {
  items: MediaItem[];
  isOwn: boolean;
  timestamp: string;
  onOpenLightbox: (index: number) => void;
}

const MediaGroupMosaic: React.FC<MediaGroupMosaicProps> = ({ items, isOwn, timestamp, onOpenLightbox }) => {
  const count = items.length;

  return (
    <div className="rounded-xl overflow-hidden relative" style={{ gap: 0 }}>
      {count === 1 && <Layout1 items={items} onOpen={onOpenLightbox} />}
      {count === 2 && <Layout2 items={items} onOpen={onOpenLightbox} />}
      {count === 3 && <Layout3 items={items} onOpen={onOpenLightbox} />}
      {count === 4 && <Layout4 items={items} onOpen={onOpenLightbox} />}
      {count >= 5 && <Layout5Plus items={items} onOpen={onOpenLightbox} />}

      {/* Timestamp overlay on last cell */}
      <div className="absolute bottom-1.5 right-2 z-10">
        <span className="text-[11px] text-white bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
          {timestamp}
        </span>
      </div>
    </div>
  );
};

// --- Individual Cell ---
const MediaCell: React.FC<{
  item: MediaItem;
  index: number;
  onOpen: (i: number) => void;
  className?: string;
  style?: React.CSSProperties;
}> = ({ item: source, index, onOpen, className = '', style }) => {
  const media = useChatMediaUrls([source.url]);
  const item = { ...source, url: media.url(source.url) };
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState('');

  useEffect(() => {
    if (item.type === 'video' && videoRef.current) {
      const handleMeta = () => {
        const d = videoRef.current?.duration || 0;
        const m = Math.floor(d / 60);
        const s = Math.floor(d % 60).toString().padStart(2, '0');
        setDuration(`${m}:${s}`);
      };
      videoRef.current.addEventListener('loadedmetadata', handleMeta);
      return () => videoRef.current?.removeEventListener('loadedmetadata', handleMeta);
    }
  }, [item]);

  return (
    <div
      className={`relative overflow-hidden cursor-pointer ${className}`}
      style={style}
      onClick={() => onOpen(index)}
    >
      {/* Shimmer skeleton */}
      {media.failed(source.url) ? (
        <button type="button" className="absolute inset-0 z-10 bg-muted px-2 text-sm" onClick={event => { event.stopPropagation(); media.retry(); }}>Attachment unavailable · Retry</button>
      ) : !loaded && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center"><SerkleLoader size="sm" label="Loading attachment" /></div>
      )}

      {item.type === 'photo' ? (
        <img
          src={item.url || undefined}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <>
          <video
            ref={videoRef}
            src={item.url || undefined}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
            playsInline
            onLoadedData={() => setLoaded(true)}
          />
          {/* Play icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-11 h-11 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>
          {/* Duration badge */}
          {duration && (
            <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium rounded px-1.5 py-0.5">
              {duration}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// --- Layout: 1 file ---
const Layout1: React.FC<{ items: MediaItem[]; onOpen: (i: number) => void }> = ({ items, onOpen }) => (
  <MediaCell item={items[0]} index={0} onOpen={onOpen} style={{ maxHeight: 300, minHeight: 180 }} />
);

// --- Layout: 2 files ---
const Layout2: React.FC<{ items: MediaItem[]; onOpen: (i: number) => void }> = ({ items, onOpen }) => (
  <div className="flex gap-[2px]" style={{ height: 220 }}>
    <MediaCell item={items[0]} index={0} onOpen={onOpen} className="flex-1" />
    <MediaCell item={items[1]} index={1} onOpen={onOpen} className="flex-1" />
  </div>
);

// --- Layout: 3 files ---
const Layout3: React.FC<{ items: MediaItem[]; onOpen: (i: number) => void }> = ({ items, onOpen }) => (
  <div className="flex gap-[2px]" style={{ height: 240 }}>
    <MediaCell item={items[0]} index={0} onOpen={onOpen} className="flex-1" />
    <div className="flex flex-col gap-[2px] flex-1">
      <MediaCell item={items[1]} index={1} onOpen={onOpen} className="flex-1" />
      <MediaCell item={items[2]} index={2} onOpen={onOpen} className="flex-1" />
    </div>
  </div>
);

// --- Layout: 4 files ---
const Layout4: React.FC<{ items: MediaItem[]; onOpen: (i: number) => void }> = ({ items, onOpen }) => (
  <div className="flex gap-[2px]" style={{ height: 280 }}>
    <MediaCell item={items[0]} index={0} onOpen={onOpen} className="flex-1" />
    <div className="flex flex-col gap-[2px] flex-1">
      <MediaCell item={items[1]} index={1} onOpen={onOpen} className="flex-1" />
      <MediaCell item={items[2]} index={2} onOpen={onOpen} className="flex-1" />
      <MediaCell item={items[3]} index={3} onOpen={onOpen} className="flex-1" />
    </div>
  </div>
);

// --- Layout: 5+ files ---
const Layout5Plus: React.FC<{ items: MediaItem[]; onOpen: (i: number) => void }> = ({ items, onOpen }) => {
  const rest = items.slice(1);
  const rows: MediaItem[][] = [];
  for (let i = 0; i < rest.length; i += 3) {
    rows.push(rest.slice(i, i + 3));
  }

  return (
    <div className="flex flex-col gap-[2px]">
      <MediaCell item={items[0]} index={0} onOpen={onOpen} style={{ height: 180 }} />
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-[2px]" style={{ height: 100 }}>
          {row.map((item, ci) => {
            const globalIndex = 1 + ri * 3 + ci;
            return (
              <MediaCell
                key={item.id}
                item={item}
                index={globalIndex}
                onOpen={onOpen}
                className="flex-1"
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MediaGroupMosaic;
