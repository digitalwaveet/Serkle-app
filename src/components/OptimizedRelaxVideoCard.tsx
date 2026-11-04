import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { getAutoplaySetting } from '@/hooks/useAutoplaySettings';
import { Heart, MessageCircle, Share, Bookmark, Volume2, VolumeX, Plus, Check } from 'lucide-react';
import { Video } from '@/data/mock';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useFollowMutations } from '@/hooks/useFollowMutations';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { videoLogger, loadHlsJs, isHlsSource, supportsNativeHls } from '@/utils/videoUtils';
import PublicProfileModal from '@/components/PublicProfileModal';
import { VideoShareMenu } from '@/components/VideoShareMenu';

interface OptimizedRelaxVideoCardProps {
  video: Video;
  isCurrent: boolean;
  isAdjacent: boolean;
  preloadStrategy: 'auto' | 'metadata' | 'none';
  shouldDetachSrc: boolean;
  onVideoClick: () => void;
  onRegisterVideo: (index: number, element: HTMLVideoElement | null) => void;
  index: number;
}

const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

export const OptimizedRelaxVideoCard = memo<OptimizedRelaxVideoCardProps>(({
  video,
  isCurrent,
  isAdjacent,
  preloadStrategy,
  shouldDetachSrc,
  onVideoClick,
  onRegisterVideo,
  index,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [optimisticStats, setOptimisticStats] = useState(video.stats);
  const [followState, setFollowState] = useState<'visible' | 'checked' | 'hidden'>('visible');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const hlsRef = useRef<any>(null);
  const loadStartTime = useRef<number>(0);
  const bufferingStartTime = useRef<number>(0);
  const reducedMotion = useReducedMotion();
  const { triggerHaptic } = useHapticFeedback();
  const { toggleFollow, checkFollowStatus } = useFollowMutations();
  const { user } = useUser();
  const lastTapTime = useRef<number>(0);
  const tapCount = useRef<number>(0);

  // Check initial follow status
  useEffect(() => {
    const checkInitialFollowStatus = async () => {
      if (user && video.user.id && user.id !== video.user.id) {
        const following = await checkFollowStatus(video.user.id);
        if (following) {
          setFollowState('hidden');
        }
      }
    };
    checkInitialFollowStatus();
  }, [video.user.id, user, checkFollowStatus]);

  // Register video element
  useEffect(() => {
    onRegisterVideo(index, videoRef.current);
    return () => onRegisterVideo(index, null);
  }, [index, onRegisterVideo]);

  // Setup HLS if needed
  useEffect(() => {
    const setupVideo = async () => {
      const videoElement = videoRef.current;
      if (!videoElement || shouldDetachSrc) return;

      const videoSrc = video.url;
      
      if (isHlsSource(videoSrc)) {
        if (supportsNativeHls()) {
          // Use native HLS on Safari
          videoElement.src = videoSrc;
        } else {
          // Use HLS.js on other browsers
          const Hls = await loadHlsJs();
          if (Hls && Hls.isSupported()) {
            if (hlsRef.current) {
              hlsRef.current.destroy();
            }
            hlsRef.current = new Hls();
            hlsRef.current.loadSource(videoSrc);
            hlsRef.current.attachMedia(videoElement);
          } else {
            videoElement.src = videoSrc;
          }
        }
      } else {
        videoElement.src = videoSrc;
      }
      
      videoElement.preload = preloadStrategy;
      videoLogger.preloadStrategy(video.id, preloadStrategy);
    };

    setupVideo();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [video.url, video.id, preloadStrategy, shouldDetachSrc]);

  // Handle video events
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleLoadStart = () => {
      loadStartTime.current = performance.now();
    };

    const handleCanPlay = () => {
      if (isCurrent) {
        setShowOverlay(false);
        videoLogger.timeToFirstFrame(video.id, loadStartTime.current);
      }
    };

    const handleWaiting = () => {
      setIsBuffering(true);
      bufferingStartTime.current = performance.now();
      videoLogger.bufferingStart(video.id);
    };

    const handleCanPlayThrough = () => {
      if (isBuffering) {
        setIsBuffering(false);
        const duration = performance.now() - bufferingStartTime.current;
        videoLogger.bufferingEnd(video.id, duration);
      }
    };

    videoElement.addEventListener('loadstart', handleLoadStart);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('canplaythrough', handleCanPlayThrough);

    return () => {
      videoElement.removeEventListener('loadstart', handleLoadStart);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [video.id, isCurrent, isBuffering]);

  // Handle play/pause based on visibility
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || shouldDetachSrc) return;

    if (isCurrent && getAutoplaySetting()) {
      setShowOverlay(false);
      videoElement.play().catch(() => {
        // Auto-play failed, which is expected in many browsers
      });
    } else {
      setShowOverlay(true);
      videoElement.pause();
    }
  }, [isCurrent, shouldDetachSrc]);

  const handleLike = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newLikedState = !isLiked;
    
    // Optimistic UI update
    setIsLiked(newLikedState);
    setOptimisticStats(prev => ({
      ...prev,
      likes: newLikedState ? prev.likes + 1 : prev.likes - 1
    }));
    
    // Haptic feedback
    triggerHaptic(newLikedState ? 'success' : 'light');
    
    // TODO: Send to backend in background
  }, [isLiked, triggerHaptic]);

  const handleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  }, [isMuted]);

  const handleSave = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newSavedState = !isSaved;
    
    // Optimistic UI update
    setIsSaved(newSavedState);
    setOptimisticStats(prev => ({
      ...prev,
      saves: newSavedState ? prev.saves + 1 : prev.saves - 1
    }));
    
    // Haptic feedback
    triggerHaptic('medium');
    
    // TODO: Send to backend in background
  }, [isSaved, triggerHaptic]);

  const handleAction = useCallback((action: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    // TODO: Handle action (comment, share, etc.)
  }, [triggerHaptic]);

  // Double tap to like functionality
  const handleVideoTap = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const timeDiff = now - lastTapTime.current;
    
    if (timeDiff < 300) { // Double tap within 300ms
      tapCount.current += 1;
      if (tapCount.current === 2) {
        // Double tap detected - like the video
        e.stopPropagation();
        if (!isLiked) {
          setIsLiked(true);
          setOptimisticStats(prev => ({
            ...prev,
            likes: prev.likes + 1
          }));
          triggerHaptic('success');
        }
        tapCount.current = 0;
        return;
      }
    } else {
      tapCount.current = 1;
    }
    
    lastTapTime.current = now;
    
    // Delay single tap action to allow for double tap
    setTimeout(() => {
      if (tapCount.current === 1) {
        onVideoClick();
        tapCount.current = 0;
      }
    }, 300);
  }, [isLiked, onVideoClick, triggerHaptic]);

  return (
    <div 
      className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden cursor-pointer"
      onClick={handleVideoTap}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        poster={video.thumbnail}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        onClick={handleVideoTap}
        crossOrigin="anonymous"
      >
        {/* Captions track - placeholder for future implementation */}
        <track
          kind="captions"
          src=""
          srcLang="en"
          label="English"
          default={showCaptions}
        />
      </video>
      
      {/* Enhanced Loading/Play overlay */}
      {(showOverlay || isBuffering) && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/40 flex items-center justify-center">
          <div className="relative">
            {/* Animated background rings */}
            
            {/* Main control */}
            <div className="relative w-16 h-16 bg-card/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl border border-white/30">
              {isBuffering ? (
                <SerkleLoader size="sm" label="Buffering video" />
              ) : (
                <div className="w-0 h-0 border-l-[16px] border-l-gray-800 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* User info overlay - bottom left */}
      <div className="absolute bottom-4 left-4 right-20 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div 
              className="size-12 rounded-full flex items-center justify-center text-sm font-medium text-white border-2 border-white/30 overflow-hidden"
              style={{ backgroundColor: video.user.avatarColor }}
            >
              {video.user.avatar ? (
                <img src={video.user.avatar} alt={video.user.name} className="w-full h-full object-cover" />
              ) : (
                video.user.initials
              )}
            </div>
            {/* Follow button */}
            {followState !== 'hidden' && user?.id !== video.user.id && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!user) {
                    toast.error('Please login to follow users');
                    return;
                  }
                  const followed = await toggleFollow(video.user.id || '');
                  if (followed) {
                    setFollowState('checked');
                    setTimeout(() => setFollowState('hidden'), 1500);
                    triggerHaptic('success');
                  }
                }}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border-2 border-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 z-10"
                aria-label={`Follow ${video.user.name}`}
              >
                {followState === 'visible' ? (
                  <Plus className="w-3 h-3 text-primary" />
                ) : (
                  <Check className="w-3 h-3 text-green-500" />
                )}
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span 
                className="font-semibold text-white cursor-pointer hover:underline relative z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfileModal(true);
                }}
              >
                {video.user.name}
              </span>
              {video.user.verified && (
                <div className="size-4 bg-card rounded-full flex items-center justify-center">
                  <div className="size-2 bg-primary rounded-full" />
                </div>
              )}
            </div>
          </div>
        </div>
        
        <h3 className="font-semibold text-white mb-1 line-clamp-2">{video.title}</h3>
        <p className="text-white/80 text-sm line-clamp-2 mb-2">{video.description}</p>
        
        {video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {video.tags.slice(0, 3).map((tag) => (
              <span 
                key={tag}
                className="text-xs px-2 py-1 bg-card/20 text-white rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons - right side with enhanced styling */}
      <div className="absolute right-4 bottom-4 flex flex-col gap-3">
        <button
          onClick={handleLike}
          aria-label={`${isLiked ? 'Unlike' : 'Like'} video by ${video.user.name}`}
          className="group flex flex-col items-center gap-1 transition-all duration-200"
        >
          <div className={cn(
            "relative p-3 rounded-full backdrop-blur-md border transition-all duration-200 group-active:scale-95",
            isLiked 
              ? "bg-red-500/20 border-red-500/30 shadow-lg shadow-red-500/25" 
              : "bg-card/15 border-white/20 hover:bg-card/25 shadow-lg"
          )}>
            <Heart 
              className={cn(
                "size-6 transition-all duration-200",
                isLiked ? "fill-red-500 text-red-500 scale-110" : "text-white"
              )} 
            />
            {/* Enhanced like animation */}
            {isLiked && (
              <>
                <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse" />
              </>
            )}
          </div>
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {formatCount(optimisticStats.likes)}
          </span>
        </button>

        <button
          onClick={handleAction('comment')}
          aria-label={`Comment on video by ${video.user.name}`}
          className="group flex flex-col items-center gap-1 transition-all duration-200 active:bg-transparent"
        >
          <div className="p-3 bg-card/15 border border-white/20 rounded-full backdrop-blur-md hover:bg-card/25 transition-all duration-200 group-active:scale-95 shadow-lg active:bg-card/15">
            <MessageCircle className="size-6 text-white group-active:text-primary transition-colors" />
          </div>
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {formatCount(optimisticStats.comments)}
          </span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowShareMenu(true);
          }}
          aria-label={`Share video by ${video.user.name}`}
          className="group flex flex-col items-center gap-1 transition-all duration-200 active:bg-transparent"
        >
          <div className="p-3 bg-card/15 border border-white/20 rounded-full backdrop-blur-md hover:bg-card/25 transition-all duration-200 group-active:scale-95 shadow-lg active:bg-card/15">
            <Share className="size-6 text-white group-active:text-primary transition-colors" />
          </div>
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {formatCount(optimisticStats.shares)}
          </span>
        </button>

        <button
          onClick={handleSave}
          aria-label={`${isSaved ? 'Unsave' : 'Save'} video by ${video.user.name}`}
          className="group flex flex-col items-center gap-1 transition-all duration-200"
        >
          <div className={cn(
            "relative p-3 rounded-full backdrop-blur-md border transition-all duration-200 group-active:scale-95",
            isSaved 
              ? "bg-yellow-500/20 border-yellow-500/30 shadow-lg shadow-yellow-500/25" 
              : "bg-card/15 border-white/20 hover:bg-card/25 shadow-lg"
          )}>
            <Bookmark className={cn(
              "size-6 transition-all duration-200",
              isSaved ? "fill-yellow-500 text-yellow-500 scale-110" : "text-white"
            )} />
            {/* Save animation */}
            {isSaved && (
              <div className="absolute inset-0 rounded-full bg-yellow-500/30 animate-ping" />
            )}
          </div>
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {formatCount(optimisticStats.saves)}
          </span>
        </button>
      </div>

      {/* Mute toggle - top right with enhanced styling */}
      <button
        onClick={handleMute}
        aria-label={`${isMuted ? 'Unmute' : 'Mute'} video`}
        className={cn(
          "absolute top-4 right-4 p-3 rounded-full backdrop-blur-md border text-white transition-all duration-200 active:scale-95 shadow-lg",
          isMuted 
            ? "bg-card/15 border-white/20 hover:bg-card/25" 
            : "bg-blue-500/20 border-blue-500/30 shadow-blue-500/25"
        )}
      >
        {isMuted ? (
          <VolumeX className="size-5" />
        ) : (
          <Volume2 className="size-5 text-blue-400" />
        )}
      </button>

      {/* Captions toggle - top left with enhanced styling */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowCaptions(!showCaptions);
          triggerHaptic('light');
        }}
        aria-label={`${showCaptions ? 'Hide' : 'Show'} captions`}
        className={cn(
          "absolute top-4 left-4 p-3 rounded-full backdrop-blur-md border text-white transition-all duration-200 active:scale-95 shadow-lg",
          showCaptions 
            ? "bg-primary/20 border-primary/30 shadow-primary/25" 
            : "bg-card/15 border-white/20 hover:bg-card/25"
        )}
      >
        <svg className="size-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2h4a1 1 0 110 2h-1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 010-2h4zM6 6v9h8V6H6zm3-2V3h2v1H9z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Persistent captions display */}
      {showCaptions && (
        <div className="absolute bottom-20 left-4 right-20 bg-black/60 backdrop-blur-sm rounded-lg p-2">
          <p className="text-white text-sm text-center leading-relaxed">
            {video.description.split(' ').slice(0, 15).join(' ')}...
          </p>
        </div>
      )}

      <PublicProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userId={video.user.id || ''}
      />

      <VideoShareMenu
        isOpen={showShareMenu}
        onClose={() => setShowShareMenu(false)}
        videoId={String(video.id)}
        videoUrl={video.url}
      />
    </div>
  );
});

OptimizedRelaxVideoCard.displayName = 'OptimizedRelaxVideoCard';
