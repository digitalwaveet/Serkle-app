import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface VideoThumbnailModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoFile: File;
  onSelect: (blob: Blob, url: string) => void;
}

const VideoThumbnailModal: React.FC<VideoThumbnailModalProps> = ({
  isOpen,
  onClose,
  videoFile,
  onSelect,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [isOpen, videoFile]);

  if (!isOpen) return null;

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    const time = value[0];
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          onSelect(blob, url);
          onClose();
        }
      }, 'image/jpeg', 0.9);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={onClose} className="p-2 text-white/70 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-white font-semibold">Select Thumbnail</h2>
        <Button onClick={handleCapture} className="bg-primary hover:bg-primary/90">
          <Check className="w-4 h-4 mr-2" />
          Select Frame
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
        <div className="relative w-full max-w-2xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              playsInline
            />
          )}
          
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="size-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              {isPlaying ? <Pause className="w-8 h-8 text-white fill-current" /> : <Play className="w-8 h-8 text-white fill-current ml-1" />}
            </div>
          </button>
        </div>
      </div>

      <div className="p-6 bg-black/50 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between text-white/60 text-xs font-medium px-1">
          <span>{Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}</span>
          <span>{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}</span>
        </div>
        
        <Slider
          value={[currentTime]}
          max={duration}
          step={0.1}
          onValueChange={handleSeek}
          className="cursor-pointer"
        />

        <p className="text-center text-white/40 text-[11px] uppercase tracking-wider font-bold">
          Scroll to find the perfect cover image for your video
        </p>
      </div>
    </div>
  );
};

export default VideoThumbnailModal;
