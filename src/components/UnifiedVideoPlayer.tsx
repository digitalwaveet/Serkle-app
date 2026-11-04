import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { Video } from '@/hooks/useVideoFeed';
import { Heart, MessageCircle, Share, Bookmark, Volume2, VolumeX, Plus, Check } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useVideoMutations } from '@/hooks/useVideoMutations';
import { useFollowMutations } from '@/hooks/useFollowMutations';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PublicProfileModal from '@/components/PublicProfileModal';
import { VideoShareMenu } from '@/components/VideoShareMenu';
import { useVideoViewTracker } from '@/hooks/useVideoViewTracker';
import { formatCount } from '@/utils/formatters';

interface UnifiedVideoPlayerProps {
  video: Video;
  isActive: boolean;
  index: number;
  onVideoClick?: () => void;
}

export const UnifiedVideoPlayer = memo<UnifiedVideoPlayerProps>(({
  video,
  isActive,
  index,
  onVideoClick = () => {}
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(video.liked);
  const [isSaved, setIsSaved] = useState(video.saved);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [followState, setFollowState] = useState<'visible' | 'checked' | 'hidden'>('visible');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const { triggerHaptic } = useHapticFeedback();
  const { toggleLike, toggleSave } = useVideoMutations();
  const { toggleFollow, checkFollowStatus } = useFollowMutations();
  const { user } = useUser();

  useVideoViewTracker(videoRef.current, video.id);

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

  // Update like/save state when video changes
  useEffect(() => {
    setIsLiked(video.liked);
    setIsSaved(video.saved);
  }, [video.liked, video.saved]);

  // Simplified video loading - prevent duplicates by ensuring unique src management
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Only update src if it's different and this video should be active
    if (videoElement.src !== video.url) {
      videoElement.src = video.url;
      videoElement.preload = 'metadata';
      
      // Load metadata immediately for current video
      if (isActive && videoElement.readyState === 0) {
        videoElement.load();
      }
    }
  }, [video.url, isActive]);

  // Handle play/pause
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isActive) {
      videoElement.play().catch(() => {
        // Auto-play failed
      });
    } else {
      videoElement.pause();
    }
  }, [isActive]);

  // Loading state management
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleLoadedData = () => setIsLoading(false);

    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('loadeddata', handleLoadedData);

    return () => {
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
    };
  }, []);

  const handleLike = useCallback(async () => {
    setIsLiked(!isLiked);
    triggerHaptic('light');
    try {
      await toggleLike(video.id);
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLiked(isLiked);
    }
  }, [isLiked, triggerHaptic, video.id, toggleLike]);

  const handleSave = useCallback(async () => {
    setIsSaved(!isSaved);
    triggerHaptic('light');
    try {
      await toggleSave(video.id);
    } catch (error) {
      console.error('Error toggling save:', error);
      setIsSaved(isSaved);
    }
  }, [isSaved, triggerHaptic, video.id, toggleSave]);

  const handleMute = useCallback(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.muted = !videoElement.muted;
      setIsMuted(videoElement.muted);
    }
  }, []);

  const handleAction = useCallback(() => {
    triggerHaptic('light');
  }, [triggerHaptic]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        poster={video.thumbnail}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        onClick={onVideoClick}
        data-video-id={video.id}
        data-video-index={index}
      />

      {/* Enhanced loading indicator */}
      {isLoading && isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-radial from-black/30 via-black/20 to-transparent">
          <SerkleLoader dark label="Buffering video" />
        </div>
      )}

      {/* User info - only show for active video */}
      {isActive && (
        <div className="absolute bottom-20 left-4 right-20 text-white z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative">
              <div
                className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-sm font-semibold overflow-hidden"
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
                    const followed = await toggleFollow(video.user.id);
                    if (followed) {
                      setFollowState('checked');
                      setTimeout(() => setFollowState('hidden'), 1500);
                      triggerHaptic('success');
                    }
                  }}
                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-card border-2 border-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 z-10"
                  aria-label={`Follow ${video.user.name}`}
                >
                  {followState === 'visible' ? (
                    <Plus className="w-2.5 h-2.5 text-primary" />
                  ) : (
                    <Check className="w-2.5 h-2.5 text-green-500" />
                  )}
                </button>
              )}
            </div>
            <div>
              <p 
                className="font-semibold text-sm cursor-pointer hover:underline relative z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfileModal(true);
                }}
              >
                {video.user.name}
              </p>
              <p className="text-xs opacity-80">@{video.user.name.toLowerCase().replace(/\s+/g, '')}</p>
            </div>
          </div>
          <h3 className="font-semibold text-sm mb-1 line-clamp-1">{video.title}</h3>
          <p className="text-sm mb-2 line-clamp-2 text-white/80">{video.description}</p>
          {video.tags && video.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {video.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-card/20 text-white rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons with enhanced styling - only show for active video */}
      {isActive && (
        <div className="absolute bottom-20 right-4 flex flex-col items-center gap-4 z-10">
        <button 
          onClick={handleLike}
          className="group flex flex-col items-center gap-1 transition-all duration-200"
        >
          <div className={cn(
            "relative w-14 h-14 rounded-full backdrop-blur-md border flex items-center justify-center group-active:scale-95 transition-all duration-200 shadow-lg",
            isLiked 
              ? "bg-red-500/20 border-red-500/30 shadow-red-500/25" 
              : "bg-card/15 border-white/20 hover:bg-card/25"
          )}>
            <Heart 
              className={cn(
                "w-7 h-7 transition-all duration-200",
                isLiked ? "fill-red-500 text-red-500 scale-110" : "text-white"
              )}
            />
            {/* Like animation */}
            {isLiked && (
              <>
                <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse" />
              </>
            )}
          </div>
          <span className="text-white text-xs font-medium drop-shadow-sm">{formatCount(video.stats.likes + (isLiked ? 1 : 0))}</span>
        </button>

        <button 
          onClick={handleAction}
          className="group flex flex-col items-center gap-1 transition-all duration-200 active:bg-transparent"
        >
          <div className="w-14 h-14 rounded-full bg-card/15 backdrop-blur-md border border-white/20 flex items-center justify-center group-active:scale-95 hover:bg-card/25 transition-all duration-200 shadow-lg active:bg-card/15">
            <MessageCircle className="w-7 h-7 text-white group-active:text-primary transition-colors" />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-sm">{formatCount(video.stats.comments)}</span>
        </button>

        <button 
          onClick={() => setShowShareMenu(true)}
          className="group flex flex-col items-center gap-1 transition-all duration-200 active:bg-transparent"
        >
          <div className="w-14 h-14 rounded-full bg-card/15 backdrop-blur-md border border-white/20 flex items-center justify-center group-active:scale-95 hover:bg-card/25 transition-all duration-200 shadow-lg active:bg-card/15">
            <Share className="w-7 h-7 text-white group-active:text-primary transition-colors" />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-sm">{formatCount(video.stats.shares)}</span>
        </button>

        <button 
          onClick={handleSave}
          className="group flex flex-col items-center gap-1 transition-all duration-200"
        >
          <div className={cn(
            "w-14 h-14 rounded-full backdrop-blur-md border flex items-center justify-center group-active:scale-95 transition-all duration-200 shadow-lg",
            isSaved 
              ? "bg-yellow-500/20 border-yellow-500/30 shadow-yellow-500/25" 
              : "bg-card/15 border-white/20 hover:bg-card/25"
          )}>
            <Bookmark className={cn(
              "w-7 h-7 transition-all duration-200",
              isSaved ? "fill-yellow-500 text-yellow-500" : "text-white"
            )} />
          </div>
        </button>

        <button 
          onClick={handleMute}
          className={cn(
            "w-14 h-14 rounded-full backdrop-blur-md border flex items-center justify-center active:scale-95 transition-all duration-200 shadow-lg",
            isMuted 
              ? "bg-card/15 border-white/20 hover:bg-card/25" 
              : "bg-blue-500/20 border-blue-500/30 shadow-blue-500/25"
          )}
        >
          {isMuted ? (
            <VolumeX className="w-7 h-7 text-white" />
          ) : (
            <Volume2 className="w-7 h-7 text-blue-400" />
          )}
        </button>
      </div>
      )}

      <PublicProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userId={video.user.id}
      />

      <VideoShareMenu
        isOpen={showShareMenu}
        onClose={() => setShowShareMenu(false)}
        videoId={video.id}
        videoUrl={video.url}
      />
    </div>
  );
});

UnifiedVideoPlayer.displayName = 'UnifiedVideoPlayer';
