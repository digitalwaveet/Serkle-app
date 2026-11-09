import { useEffect, useRef, useState } from "react";
import { ImageOff, Play, RefreshCw } from "lucide-react";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import { useChatMediaUrls } from "@/hooks/useChatMediaUrls";
import { formatVideoDuration } from "@/lib/videoDuration";
import { OptimizedImage } from '@/components/ui/OptimizedImage';
export interface MediaItem {
  id: string;
  url: string;
  type: "photo" | "video";
  caption?: string;
}
interface Props {
  items: MediaItem[];
  isOwn: boolean;
  timestamp: string;
  onOpenLightbox: (index: number) => void;
}
export default function MediaGroupMosaic({
  items,
  timestamp,
  onOpenLightbox,
}: Props) {
  if (!items.length) return null;
  return (
    <div
      className="msg-media-mosaic"
      data-count={Math.min(items.length, 5)}
      data-testid="message-media-mosaic"
    >
      {items.map((item, index) => (
        <MediaCell
          key={item.id}
          item={item}
          index={index}
          onOpen={onOpenLightbox}
        />
      ))}
      <span className="msg-media-timestamp">{timestamp}</span>
    </div>
  );
}
function MediaCell({
  item,
  index,
  onOpen,
}: {
  item: MediaItem;
  index: number;
  onOpen: (index: number) => void;
}) {
  const media = useChatMediaUrls([item.url], item.type === 'video'),
    url = media.url(item.url),
    video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(""),
    [failed, setFailed] = useState(""),
    [attempt, setAttempt] = useState(0),
    [duration, setDuration] = useState<string | null>(null);
  const sourceKey = `${url}:${attempt}`,
    unavailable = media.failed(item.url) || failed === sourceKey;
  useEffect(() => {
    setDuration(null);
  }, [sourceKey]);
  if (item.type === 'photo') return <div className="msg-media-cell" data-testid="message-media-cell">
    <OptimizedImage src={item.url} size="thumb" alt={item.caption && item.caption !== '📷 Photo' ? item.caption : `Shared photo ${index + 1}`}
      className="msg-media-open h-full" imageClassName="object-cover" style={{ aspectRatio: 'auto', height: '100%' }}
      retryLabel={`Retry attachment ${index + 1}`}
      onOpen={() => onOpen(index)} openLabel={`Open photo ${index + 1}`} />
  </div>;
  return (
    <div
      className="msg-media-cell"
      data-testid="message-media-cell"
      aria-busy={!unavailable && ready !== sourceKey}
    >
      {unavailable ? (
        <div className="msg-media-unavailable">
          <ImageOff aria-hidden="true" />
          <span>Attachment unavailable</span>
          <button
            type="button"
            className="msg-button secondary"
            onClick={() => {
              setAttempt((value) => value + 1);
              media.retry();
            }}
            aria-label={`Retry attachment ${index + 1}`}
          >
            <RefreshCw aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : (
        <>
          {ready !== sourceKey && (
            <div className="msg-media-loading">
              <SerkleLoader size="xs" label="Loading attachment" />
            </div>
          )}
          <button
            type="button"
            className="msg-media-open"
            disabled={!url}
            aria-label={`Open ${item.type} ${index + 1}`}
            onClick={() => onOpen(index)}
          >
                <video
                  ref={video}
                  key={sourceKey}
                  src={url || undefined}
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={() => {
                    setReady(sourceKey);
                    setDuration(formatVideoDuration(video.current?.duration));
                  }}
                  onDurationChange={() =>
                    setDuration(formatVideoDuration(video.current?.duration))
                  }
                  onError={() => {
                    if (url) setFailed(sourceKey);
                    setDuration(null);
                  }}
                />
                <span className="msg-media-play">
                  <Play aria-hidden="true" />
                </span>
                {duration && (
                  <span className="msg-media-duration">{duration}</span>
                )}
          </button>
        </>
      )}
    </div>
  );
}
