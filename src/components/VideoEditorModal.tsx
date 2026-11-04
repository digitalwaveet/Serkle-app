import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Play, Pause, Check, Scissors, ImageIcon, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { captureFrameAt, sampleFrames } from '@/lib/videoUtils';

interface VideoEditorResult {
  thumbnailBlob: Blob;
  trimStart: number;
  trimEnd: number;
}

interface VideoEditorModalProps {
  videoFile: File;
  videoUrl: string;
  onDone: (result: VideoEditorResult) => void;
  onCancel: () => void;
}

type Tab = 'preview' | 'thumbnail' | 'trim';

const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoEditorModal: React.FC<VideoEditorModalProps> = ({
  videoFile,
  videoUrl,
  onDone,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('preview');

  // Thumbnail state
  const [filmstrip, setFilmstrip] = useState<{ url: string; time: number; blob: Blob }[]>([]);
  const [loadingFilmstrip, setLoadingFilmstrip] = useState(false);
  const [selectedThumb, setSelectedThumb] = useState<{ blob: Blob; url: string } | null>(null);
  const [capturingFrame, setCapturingFrame] = useState(false);

  // Trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState<number | null>(null); // null = full duration

  // ─── Video events ──────────────────────────────────────────────────────────
  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    console.log('[VideoEditor] Metadata loaded. Duration:', v.duration);
    setDuration(v.duration);
    if (trimEnd === null || trimEnd === 0) {
      setTrimEnd(v.duration);
    }
  };

  // Sync duration if video is already ready or changed
  useEffect(() => {
    const v = videoRef.current;
    if (v && v.readyState >= 1) { // HAVE_METADATA
      console.log('[VideoEditor] Video already has metadata. Duration:', v.duration);
      setDuration(v.duration);
      if (trimEnd === null || trimEnd === 0) {
        setTrimEnd(v.duration);
      }
    }
  }, [videoUrl, trimEnd]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    // Loop trim range during preview tab
    const end = trimEnd ?? v.duration;
    if (activeTab === 'trim' && v.currentTime >= end) {
      v.currentTime = trimStart;
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // ─── Pause when switching tabs ────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setIsPlaying(false);
    if (activeTab === 'trim') {
      v.currentTime = trimStart;
    }
  }, [activeTab]);

  // ─── Load filmstrip when thumbnail or trim tab opens ────────────────────────
  useEffect(() => {
    if ((activeTab !== 'thumbnail' && activeTab !== 'trim') || filmstrip.length > 0) return;
    
    let isMounted = true;
    setLoadingFilmstrip(true);
    console.log('[VideoEditor] Loading filmstrip for tab:', activeTab);
    
    sampleFrames(videoFile, 5)
      .then((frames) => {
        if (!isMounted) {
          // If unmounted during sampling, cleanup the new blobs immediately
          frames.forEach(f => URL.revokeObjectURL(f.url));
          return;
        }
        setFilmstrip(frames);
        if (!selectedThumb && frames.length > 0) {
          setSelectedThumb({ blob: frames[0].blob, url: frames[0].url });
        }
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) setLoadingFilmstrip(false);
      });
      
    return () => {
      isMounted = false;
    };
  }, [activeTab, videoFile]);

  // Clean up all filmstrip blob URLs when the component unmounts
  useEffect(() => {
    return () => {
      if (filmstrip.length > 0) {
        console.log('[VideoEditor] Revoking filmstrip blob URLs on unmount');
        filmstrip.forEach(frame => URL.revokeObjectURL(frame.url));
      }
    };
  }, [filmstrip]);

  // ─── Capture current frame as thumbnail ───────────────────────────────────
  const handleCaptureCurrent = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    setCapturingFrame(true);
    try {
      v.pause();
      setIsPlaying(false);
      const frame = await captureFrameAt(v);
      setSelectedThumb(frame);
    } catch (e) {
      console.error(e);
    } finally {
      setCapturingFrame(false);
    }
  }, []);

  // ─── Seek via timeline slider ──────────────────────────────────────────────
  const handleSeek = (val: number[]) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = val[0];
    setCurrentTime(val[0]);
  };

  // ─── Trim handles ─────────────────────────────────────────────────────────
  const handleTrimStartChange = (val: number[]) => {
    const s = Math.min(val[0], (trimEnd ?? duration) - 0.5);
    setTrimStart(s);
    if (videoRef.current) videoRef.current.currentTime = s;
  };
  const handleTrimEndChange = (val: number[]) => {
    const e = Math.max(val[0], trimStart + 0.1);
    setTrimEnd(e);
    if (videoRef.current) videoRef.current.currentTime = e;
  };

  // ─── Done ──────────────────────────────────────────────────────────────────
  const handleDone = async () => {
    let thumb = selectedThumb;
    if (!thumb) {
      // Auto-capture frame at trimStart
      const v = videoRef.current;
      if (v) {
        v.currentTime = trimStart;
        await new Promise(r => setTimeout(r, 200));
        try { thumb = await captureFrameAt(v); } catch {}
      }
    }
    if (!thumb) return;
    onDone({
      thumbnailBlob: thumb.blob,
      trimStart,
      trimEnd: trimEnd ?? duration,
    });
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'preview', label: 'Preview', icon: Play },
    { id: 'thumbnail', label: 'Thumbnail', icon: ImageIcon },
    { id: 'trim', label: 'Trim', icon: Scissors },
  ];

  const trimEndVal = trimEnd ?? duration;
  const trimPct = duration > 0 ? ((trimEndVal - trimStart) / duration) * 100 : 100;
  const trimOffsetPct = duration > 0 ? (trimStart / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[var(--black)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-top py-3 bg-[var(--black)]/90 backdrop-blur-md border-b border-white/10">
        <button
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-[var(--white)]">Edit Video</h2>
        <Button
          size="sm"
          onClick={handleDone}
          className="bg-primary text-primary-foreground px-5 h-8 text-sm font-bold rounded-full"
        >
          <Check className="w-4 h-4 mr-1" />
          Done
        </Button>
      </div>

      {/* Video Preview */}
      <div
        className="relative flex-1 flex items-center justify-center bg-[var(--black)] cursor-pointer"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-h-full max-w-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          playsInline
          preload="metadata"
        />
        {/* Play / Pause icon overlay */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200',
            isPlaying ? 'opacity-0' : 'opacity-100'
          )}
        >
          <div className="p-5 rounded-full bg-white/20 backdrop-blur-md">
            <Play className="w-10 h-10 text-white fill-current" />
          </div>
        </div>

        {/* Time badge */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-lg bg-black/60 text-white text-xs font-mono">
          {fmt(currentTime)} / {fmt(duration)}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[var(--black)]/95 border-t border-white/10">
        <div className="flex">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors',
                activeTab === id
                  ? 'text-primary border-t-2 border-primary'
                  : 'text-white/40 hover:text-white/70 border-t-2 border-transparent'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="px-4 pb-safe-bottom pb-4">

          {/* ── PREVIEW TAB ── */}
          {activeTab === 'preview' && (
            <div className="pt-3 space-y-3">
              <p className="text-white/50 text-xs text-center">Tap the video above to play/pause</p>
              {/* Seekbar */}
              <div className="space-y-1">
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 1}
                  step={0.05}
                  onValueChange={handleSeek}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-white/40 font-mono">
                  <span>{fmt(currentTime)}</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── THUMBNAIL TAB ── */}
          {activeTab === 'thumbnail' && (
            <div className="pt-3 space-y-3">
              {loadingFilmstrip ? (
                <div className="flex items-center justify-center py-6">
                  <SerkleLoader size="sm" className="text-primary" />
                  <span className="ml-2 text-white/50 text-sm">Generating frames…</span>
                </div>
              ) : (
                <>
                  {/* Filmstrip */}
                  <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {filmstrip.map((frame, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedThumb({ blob: frame.blob, url: frame.url })}
                        className={cn(
                          'relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all',
                          selectedThumb?.url === frame.url
                            ? 'border-primary scale-105 shadow-lg shadow-primary/40'
                            : 'border-white/10 hover:border-white/30'
                        )}
                      >
                        <img src={frame.url} alt={`Frame ${i}`} className="w-full h-full object-cover" />
                        {selectedThumb?.url === frame.url && (
                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                            <Check className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-white/60 font-mono">
                          {fmt(frame.time)}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Selected thumbnail preview */}
                  {selectedThumb && (
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedThumb.url}
                        alt="Selected thumbnail"
                        className="w-16 h-12 rounded-lg object-cover border border-primary"
                      />
                      <div>
                        <p className="text-white text-xs font-bold">Selected Thumbnail</p>
                        <p className="text-white/40 text-[10px]">This frame will be used as cover</p>
                      </div>
                    </div>
                  )}

                  {/* Capture current frame */}
                  <div className="space-y-2">
                    <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Or pick any moment</p>
                    <div className="flex gap-2 items-center">
                      <Slider
                        value={[currentTime]}
                        min={0}
                        max={duration || 1}
                        step={0.05}
                        onValueChange={(v) => {
                          if (videoRef.current) videoRef.current.currentTime = v[0];
                          setCurrentTime(v[0]);
                        }}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCaptureCurrent}
                        disabled={capturingFrame}
                        className="shrink-0 border-white/20 text-white hover:bg-white/10 text-xs h-8"
                      >
                        {capturingFrame ? <SerkleLoader size="xs" className="text-current" /> : 'Capture'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TRIM TAB ── */}
          {activeTab === 'trim' && (
            <div className="pt-3 space-y-4">
              {/* Visual trim bar */}
              <div className="relative h-10 rounded-xl overflow-hidden bg-white/10">
                {/* Filmstrip background */}
                <div className="absolute inset-0 flex">
                  {filmstrip.map((f, i) => (
                    <div key={i} className="flex-1 overflow-hidden">
                      <img src={f.url} alt="" className="w-full h-full object-cover opacity-50" />
                    </div>
                  ))}
                </div>
                {/* Dimmed regions */}
                <div
                  className="absolute inset-y-0 left-0 bg-black/70"
                  style={{ width: `${trimOffsetPct}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-black/70"
                  style={{ width: `${100 - trimOffsetPct - trimPct}%` }}
                />
                {/* Active range outline */}
                <div
                  className="absolute inset-y-0 border-2 border-primary rounded-sm"
                  style={{ left: `${trimOffsetPct}%`, width: `${trimPct}%` }}
                />
                {/* Current time needle */}
                {duration > 0 && (
                  <div
                    className="absolute inset-y-0 w-0.5 bg-white/80"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />
                )}
              </div>

              {/* Trim start */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-white/60 uppercase tracking-widest">Trim Start</span>
                  <span className="text-primary font-mono">{fmt(trimStart)}</span>
                </div>
                <Slider
                  value={[trimStart]}
                  min={0}
                  max={trimEndVal - 0.5}
                  step={0.05}
                  onValueChange={handleTrimStartChange}
                  className="w-full"
                />
              </div>

              {/* Trim end */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-white/60 uppercase tracking-widest">Trim End</span>
                  <span className="text-primary font-mono">{fmt(trimEndVal)}</span>
                </div>
                <Slider
                  value={[trimEndVal]}
                  min={trimStart + 0.5}
                  max={duration}
                  step={0.05}
                  onValueChange={handleTrimEndChange}
                  className="w-full"
                />
              </div>

              {/* Duration badge */}
              <div className="flex items-center justify-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                <Scissors className="w-3.5 h-3.5 text-primary" />
                <span className="text-white/70 text-xs font-bold">
                  Clip Duration: <span className="text-primary font-mono">{fmt(trimEndVal - trimStart)}</span>
                </span>
              </div>

              <p className="text-white/30 text-[10px] text-center">
                Note: Trim range is saved as metadata. Video is not re-encoded on device.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default VideoEditorModal;
