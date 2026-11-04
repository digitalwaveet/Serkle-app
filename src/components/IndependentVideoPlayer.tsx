import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Video } from '@/data/mock';
import { Heart, MessageCircle, Share, Bookmark, Volume2, VolumeX } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { VideoShareMenu } from '@/components/VideoShareMenu';

interface IndependentVideoPlayerProps {
  video: Video;
  isActive: boolean;
  onVideoClick?: () => void;
}

const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

export const IndependentVideoPlayer: React.FC<IndependentVideoPlayerProps> = ({
  video,
  isActive,
  onVideoClick = () => {}
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const { triggerHaptic } = useHapticFeedback();

  // Handle video play/pause based on active state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.play().catch(() => {
        // Auto-play failed, which is expected in many browsers
      });
    } else {
      video.pause();
    }
  }, [isActive]);

  // Handle video loading events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlayThrough = () => setIsLoading(false);

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplaythrough', handleCanPlayThrough);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, []);

  const handleLike = useCallback(() => {
    setIsLiked(!isLiked);
    triggerHaptic('light');
  }, [isLiked, triggerHaptic]);

  const handleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  }, []);

  const handleAction = useCallback((action: string) => {
    triggerHaptic('light');
    console.log(`${action} action for video ${video.id}`);
  }, [video.id, triggerHaptic]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={video.thumbnail}
        className="w-full h-full object-cover absolute inset-0"
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        onClick={onVideoClick}
        style={{ objectFit: 'cover' }}
      >
        <source src={video.url} type="video/mp4" />
      </video>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <SerkleLoader size="md" dark label="Buffering video" />
        </div>
      )}

      {/* User Info Overlay */}
      <div className="absolute bottom-20 left-4 right-20 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div 
            className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-sm font-semibold"
            style={{ backgroundColor: video.user.avatarColor }}
          >
            {video.user.initials}
          </div>
          <div>
            <p className="font-semibold text-sm">{video.user.name}</p>
            <p className="text-xs opacity-80">@{video.user.name.toLowerCase().replace(/\s+/g, '')}</p>
          </div>
        </div>
        <p className="text-sm mb-3 line-clamp-3">{video.description}</p>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-20 right-4 flex flex-col items-center gap-6">
        <button 
          onClick={handleLike}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center group-active:scale-95 transition-transform">
            <Heart 
              className={`w-6 h-6 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
            />
          </div>
          <span className="text-white text-xs">{formatCount(video.stats.likes + (isLiked ? 1 : 0))}</span>
        </button>

        <button 
          onClick={() => handleAction('comment')}
          className="flex flex-col items-center gap-1 group active:bg-transparent"
        >
          <div className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center group-active:scale-95 transition-transform active:bg-black/20">
            <MessageCircle className="w-6 h-6 text-white group-active:text-primary transition-colors" />
          </div>
          <span className="text-white text-xs">{formatCount(video.stats.comments)}</span>
        </button>

        <button 
          onClick={() => setShowShareMenu(true)}
          className="flex flex-col items-center gap-1 group active:bg-transparent"
        >
          <div className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center group-active:scale-95 transition-transform active:bg-black/20">
            <Share className="w-6 h-6 text-white group-active:text-primary transition-colors" />
          </div>
          <span className="text-white text-xs">{formatCount(video.stats.shares)}</span>
        </button>

        <button 
          onClick={() => handleAction('save')}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center group-active:scale-95 transition-transform">
            <Bookmark className="w-6 h-6 text-white" />
          </div>
        </button>

        <button 
          onClick={handleMute}
          className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
        >
          {isMuted ? (
            <VolumeX className="w-6 h-6 text-white" />
          ) : (
            <Volume2 className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      <VideoShareMenu
        isOpen={showShareMenu}
        onClose={() => setShowShareMenu(false)}
        videoId={String(video.id)}
        videoUrl={video.url}
      />
    </div>
  );
};
