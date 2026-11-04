import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useRef, useEffect } from 'react';
import { Download, MapPin, Play, Pause, ExternalLink, Image as ImageIcon, Film } from 'lucide-react';
import { useNavigation } from '@/contexts/NavigationContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useChatMediaUrls } from '@/hooks/useChatMediaUrls';

const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g;

const LinkifiedText: React.FC<{ text: string; isOwn: boolean }> = ({ text, isOwn }) => {
  const parts = text.split(URL_REGEX);
  
  return (
    <>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline underline-offset-2 break-all ${
                isOwn ? 'text-primary-foreground/90 hover:text-primary-foreground' : 'text-primary hover:text-primary/80'
              } transition-colors`}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

interface MessageBubbleProps {
  content: string;
  messageType: string;
  attachmentUrl?: string | null;
  isOwn: boolean;
  onInvitationClick?: (invitationId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ content, messageType, attachmentUrl: reference, isOwn, onInvitationClick }) => {
  const media = useChatMediaUrls([reference]);
  const attachmentUrl = media.url(reference);
  if (reference?.startsWith('chat-media://') && !attachmentUrl) {
    return media.failed(reference)
      ? <button type="button" onClick={media.retry} className="min-h-11 px-3 text-sm">Attachment unavailable · Retry</button>
      : <SerkleLoader size="sm" label="Loading private attachment" />;
  }
  if (messageType === 'text' || !attachmentUrl) {
    const invitationMatch = content.match(/\[([^\]]+)\]\(circle-invitation:([a-f0-9-]+)\)/);
    if (invitationMatch) {
      const linkText = invitationMatch[1];
      const invitationId = invitationMatch[2];
      const parts = content.split(invitationMatch[0]);
      
      return (
        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed min-w-0" dir="auto" style={{ overflowWrap: 'anywhere' }}>
          {parts[0]}
          <button
            onClick={() => onInvitationClick?.(invitationId)}
            className={`inline font-semibold underline underline-offset-2 ${
              isOwn ? 'text-primary-foreground/90 hover:text-primary-foreground' : 'text-primary hover:text-primary/80'
            } transition-colors`}
          >
            {linkText}
          </button>
          {parts[1]}
        </div>
      );
    }
    return (
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed min-w-0" dir="auto" style={{ overflowWrap: 'anywhere' }}>
        <LinkifiedText text={content} isOwn={isOwn} />
      </p>
    );
  }

  if (messageType === 'photo') {
    return <PhotoBubble url={attachmentUrl} caption={content} isOwn={isOwn} />;
  }

  if (messageType === 'video') {
    return <VideoBubble url={attachmentUrl} caption={content} isOwn={isOwn} />;
  }

  if (messageType === 'voice') {
    return <VoiceBubble url={attachmentUrl} content={content} isOwn={isOwn} />;
  }

  if (messageType === 'location') {
    return <LocationBubble url={attachmentUrl} content={content} isOwn={isOwn} />;
  }

  if (messageType === 'file') {
    return <FileBubble url={attachmentUrl} content={content} isOwn={isOwn} />;
  }

  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed min-w-0" dir="auto" style={{ overflowWrap: 'anywhere' }}>
      <LinkifiedText text={content} isOwn={isOwn} />
    </p>
  );
};

// ---- Photo Bubble ----
const PhotoBubble: React.FC<{ url: string; caption: string; isOwn: boolean }> = ({ url, caption, isOwn }) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { pushModalState } = useNavigation();
  const isCaption = caption && caption !== '📷 Photo';
  const isOptimistic = url.startsWith('blob:');

  return (
    <>
      <div className="cursor-pointer">
        <div className="relative max-w-[260px] max-h-[320px] overflow-hidden rounded-lg bg-muted/20">
          {(isLoading || isOptimistic) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted/30 backdrop-blur-[2px]">
              <SerkleLoader size="sm" className="text-primary opacity-60" />
              <span className="mt-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                {isOptimistic ? 'Sending...' : 'Downloading...'}
              </span>
            </div>
          )}
          <img
            src={url}
            alt="Photo"
            className={`w-full h-full object-cover transition-all duration-500 ${isLoading && !isOptimistic ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            style={{ maxHeight: '320px', minHeight: '120px', minWidth: '160px' }}
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            onClick={(e) => { 
              if (isOptimistic) return;
              e.stopPropagation(); 
              pushModalState('photo-fullscreen', () => setFullscreen(false));
              setFullscreen(true); 
            }}
          />
        </div>
        {isCaption && (
          <p className="px-2 pt-2 pb-1 text-[14px] whitespace-pre-wrap break-words" dir="auto" style={{ overflowWrap: 'anywhere' }}>{caption}</p>
        )}
      </div>
      {fullscreen && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={() => window.history.back()}
        >
          <img src={url} alt="Full" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  );
};

// ---- Video Bubble ----
const VideoBubble: React.FC<{ url: string; caption: string; isOwn: boolean }> = ({ url, caption, isOwn }) => {
  const [playing, setPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isCaption = caption && caption !== '🎥 Video';
  const isOptimistic = url.startsWith('blob:');

  const togglePlay = () => {
    if (isLoading || isOptimistic) return;
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  return (
    <div className="-mx-4 -mt-2.5 -mb-2.5">
      <div className="relative cursor-pointer overflow-hidden rounded-2xl border border-border/50 shadow-sm max-w-[260px] max-h-[320px] bg-muted/20" onClick={togglePlay}>
        {(isLoading || isOptimistic) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted/40 backdrop-blur-[2px]">
            <SerkleLoader size="sm" className="text-primary opacity-60" />
            <span className="mt-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest text-center px-4">
              {isOptimistic ? 'Sending Video...' : 'Downloading Video...'}
            </span>
          </div>
        )}
        <video
          ref={videoRef}
          src={url}
          className={`w-full object-cover transition-opacity duration-500 ${isLoading && !isOptimistic ? 'opacity-0' : 'opacity-100'}`}
          preload="metadata"
          playsInline
          onLoadedData={() => setIsLoading(false)}
          onEnded={() => setPlaying(false)}
        />
        {!playing && !isLoading && !isOptimistic && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Play className="h-7 w-7 text-white fill-white ml-1" />
            </div>
          </div>
        )}
      </div>
      {isCaption && (
        <p className="px-4 py-2 text-[14px] whitespace-pre-wrap break-words" dir="auto">{caption}</p>
      )}
    </div>
  );
};

// ---- Voice Bubble ----
const VoiceBubble: React.FC<{ url: string; content: string; isOwn: boolean }> = ({ url, content, isOwn }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animFrameRef = useRef<number>(0);

  const durationMatch = content.match(/\((\d+)s\)/);
  const displayDuration = durationMatch ? parseInt(durationMatch[1]) : duration;

  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || isLoading) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
      const update = () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
          if (!audioRef.current.paused) {
            animFrameRef.current = requestAnimationFrame(update);
          }
        }
      };
      update();
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const bars = 28;
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
            setIsLoading(false);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isOwn ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-primary/15 hover:bg-primary/25'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <SerkleLoader size="xs" className={`${isOwn ?'text-primary-foreground':'text-primary'}`} />
        ) : playing ? (
          <Pause className={`h-5 w-5 ${isOwn ? 'text-primary-foreground' : 'text-primary'}`} />
        ) : (
          <Play className={`h-5 w-5 ml-0.5 ${isOwn ? 'text-primary-foreground' : 'text-primary'} fill-current`} />
        )}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-6">
          {Array.from({ length: bars }).map((_, i) => {
            const height = 6 + Math.sin(i * 0.8) * 12 + ((i * 7) % 10);
            const filled = i / bars <= progress;
            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-colors duration-100 ${
                  filled
                    ? isOwn ? 'bg-primary-foreground' : 'bg-primary'
                    : isOwn ? 'bg-primary-foreground/30' : 'bg-primary/30'
                }`}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>
        <span className={`text-[11px] ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {isLoading ? 'Loading audio...' : playing ? formatTime(currentTime) : formatTime(displayDuration || duration)}
        </span>
      </div>
    </div>
  );
};

// ---- Location Bubble ----
const LocationBubble: React.FC<{ url: string; content: string; isOwn: boolean }> = ({ url, content, isOwn }) => {
  const coordMatch = content.match(/([-\d.]+),\s*([-\d.]+)/);
  const lat = coordMatch ? coordMatch[1] : '';
  const lng = coordMatch ? coordMatch[2] : '';

  return (
    <div className="-mx-4 -mt-2.5 -mb-2.5">
      <div className="bg-muted/30 rounded-xl overflow-hidden shadow-sm border border-border/50">
        <div className="h-32 bg-gradient-to-br from-green-200/30 to-blue-200/30 flex items-center justify-center relative">
          <MapPin className={`h-10 w-10 ${isOwn ? 'text-primary-foreground/70' : 'text-primary'}`} />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/30 to-transparent h-12" />
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${
            isOwn ? 'text-primary-foreground hover:text-primary-foreground/80' : 'text-primary hover:text-primary/80'
          } transition-colors`}
        >
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            {lat && lng ? `${lat}, ${lng}` : 'Location'}
          </span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </a>
      </div>
    </div>
  );
};

// ---- File Bubble ----
const FileBubble: React.FC<{ url: string; content: string; isOwn: boolean }> = ({ url, content, isOwn }) => {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 text-sm ${
        isOwn ? 'text-primary-foreground/90 hover:text-primary-foreground' : 'text-primary hover:text-primary/80'
      } transition-colors p-1`}
    >
      <Download className="h-4 w-4 shrink-0" />
      <span className="truncate">{content}</span>
    </a>
  );
};

export default MessageBubble;
