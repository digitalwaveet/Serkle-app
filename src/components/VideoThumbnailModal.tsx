import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Pause, Play, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { extractVideoDuration, parseVideoDuration } from '@/lib/videoDuration';

interface VideoThumbnailModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoFile: File;
  onSelect: (blob: Blob, url: string) => void;
}

type MetadataStatus = 'loading' | 'ready' | 'error';

const formatClock = (seconds: number | null, fallback = '--:--') => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return fallback;
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const VideoThumbnailModal: React.FC<VideoThumbnailModalProps> = ({ isOpen, onClose, videoFile, onSelect }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const infinityProbeRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [metadataStatus, setMetadataStatus] = useState<MetadataStatus>('loading');
  const [metadataError, setMetadataError] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !videoFile) return;
    const controller = new AbortController();
    const url = URL.createObjectURL(videoFile);
    infinityProbeRef.current = false;
    setCurrentTime(0);
    setDuration(null);
    setIsPlaying(false);
    setIsSeeking(false);
    setIsFrameReady(false);
    setMetadataStatus('loading');
    setMetadataError('');
    setVideoUrl(url);

    void extractVideoDuration(videoFile, { signal: controller.signal, timeoutMs: 20000 }).then(seconds => {
      if (controller.signal.aborted) return;
      if (seconds !== null) {
        setDuration(seconds);
        setMetadataStatus('ready');
      } else {
        setMetadataStatus(previous => previous === 'ready' ? previous : 'error');
        setMetadataError(previous => previous || 'This video format did not provide seekable duration metadata.');
      }
    });

    return () => {
      controller.abort();
      URL.revokeObjectURL(url);
      setVideoUrl(null);
    };
  }, [isOpen, videoFile]);

  useEffect(() => {
    if (!videoUrl) return;
    const frame = requestAnimationFrame(() => videoRef.current?.load());
    return () => cancelAnimationFrame(frame);
  }, [videoUrl]);

  const syncMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const seconds = parseVideoDuration(video.duration);
    if (seconds !== null) {
      setDuration(seconds);
      setMetadataStatus('ready');
      setMetadataError('');
      if (!Number.isFinite(video.currentTime) || video.currentTime > seconds) {
        try { video.currentTime = 0; } catch { /* wait for a seekable frame */ }
      }
      return;
    }
    if (video.duration === Infinity && !infinityProbeRef.current) {
      infinityProbeRef.current = true;
      try { video.currentTime = Number.MAX_SAFE_INTEGER; } catch { /* duration probe continues */ }
    }
  }, []);

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video || duration === null) return;
    const time = Math.min(duration, Math.max(0, value[0]));
    video.pause();
    setIsPlaying(false);
    setIsSeeking(true);
    setCurrentTime(time);
    try {
      video.currentTime = time;
    } catch {
      setIsSeeking(false);
      setMetadataError('That frame could not be loaded. Try another position.');
    }
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video || metadataStatus === 'error') return;
    if (!video.paused) {
      video.pause();
      return;
    }
    try {
      await video.play();
    } catch {
      setMetadataError('Playback could not start. You can still drag the timeline to choose a frame.');
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !isFrameReady || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setMetadataError('This frame could not be captured. Please try again.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        setMetadataError('This frame could not be captured. Please try again.');
        return;
      }
      onSelect(blob, URL.createObjectURL(blob));
    }, 'image/jpeg', 0.88);
  };

  const retryPreview = () => {
    infinityProbeRef.current = false;
    setMetadataStatus('loading');
    setMetadataError('');
    setIsFrameReady(false);
    videoRef.current?.load();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="thumbnail-dialog-title">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Close thumbnail selector">
          <X className="size-6" />
        </button>
        <h2 id="thumbnail-dialog-title" className="min-w-0 flex-1 truncate text-center font-semibold text-white">Select thumbnail</h2>
        <Button onClick={handleCapture} disabled={!isFrameReady || isSeeking || metadataStatus === 'error'} className="min-h-11 rounded-full bg-primary px-4 hover:bg-primary/90">
          <Check className="mr-2 size-4" /> Select frame
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4">
        <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-xl bg-black shadow-2xl">
          {videoUrl && <video
            ref={videoRef}
            src={videoUrl}
            className="h-full w-full object-contain"
            preload="auto"
            muted
            playsInline
            onLoadedMetadata={syncMetadata}
            onDurationChange={syncMetadata}
            onLoadedData={() => { syncMetadata(); setIsFrameReady(true); }}
            onCanPlay={() => setIsFrameReady(true)}
            onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
            onSeeking={() => setIsSeeking(true)}
            onSeeked={() => { syncMetadata(); setCurrentTime(videoRef.current?.currentTime || 0); setIsSeeking(false); setIsFrameReady(true); }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={() => {
              setMetadataStatus('error');
              setMetadataError('This video cannot be previewed by your browser. Try MP4 (H.264) or upload a custom cover.');
            }}
          />}

          {metadataStatus === 'loading' && <div className="absolute inset-0 grid place-items-center bg-black/65" role="status"><SerkleLoader dark label="Reading video timeline" /></div>}
          {metadataStatus === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center text-white"><AlertCircle className="size-8 text-amber-400" /><p className="max-w-sm text-sm leading-6">{metadataError}</p><Button type="button" variant="outline" onClick={retryPreview} className="border-white/25 bg-white/10 text-white hover:bg-white/15"><RefreshCw className="mr-2 size-4" /> Retry preview</Button></div>}

          {metadataStatus !== 'error' && <button type="button" onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-transparent opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white" aria-label={isPlaying ? 'Pause video preview' : 'Play video preview'}>
            {!isPlaying && metadataStatus === 'ready' && <Play className="size-12 fill-white text-white drop-shadow-lg" />}
            {isPlaying && <Pause className="size-12 fill-white text-white opacity-0 transition-opacity hover:opacity-100" />}
          </button>}
          {isSeeking && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20"><SerkleLoader size="sm" dark label="Loading selected frame" /></div>}
        </div>
      </div>

      <div className="space-y-4 border-t border-white/10 bg-black/70 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between px-1 text-xs font-medium tabular-nums text-white/70">
          <span>{formatClock(currentTime, '0:00')}</span>
          <span data-testid="thumbnail-duration">{formatClock(duration)}</span>
        </div>
        <Slider
          value={[duration === null ? 0 : Math.min(currentTime, duration)]}
          max={duration ?? 1}
          step={0.1}
          disabled={duration === null || metadataStatus !== 'ready'}
          onValueChange={handleSeek}
          aria-label="Choose thumbnail time"
          data-testid="thumbnail-timeline"
          className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
        />
        <p className="text-center text-[11px] font-bold uppercase tracking-wider text-white/50">
          {metadataStatus === 'loading' ? 'Reading the video timeline…' : metadataStatus === 'error' ? 'Timeline unavailable' : 'Drag the timeline to choose the perfect cover'}
        </p>
      </div>
    </div>
  );
};

export default VideoThumbnailModal;
