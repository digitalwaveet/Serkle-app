import React, { useRef, useEffect, useState } from 'react';
import { getAutoplaySetting } from '@/hooks/useAutoplaySettings';
import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, Plus, Check } from 'lucide-react';
import { Video } from '@/data/mock';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFollowMutations } from '@/hooks/useFollowMutations';
import { useVideoMutations } from '@/hooks/useVideoMutations';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import PublicProfileModal from '@/components/PublicProfileModal';
import { VideoShareMenu } from '@/components/VideoShareMenu';

interface RelaxVideoCardProps {
  video: Video;
  isVisible: boolean;
  onVideoClick: () => void;
}

const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

export const RelaxVideoCard: React.FC<RelaxVideoCardProps> = ({
  video,
  isVisible,
  onVideoClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [followState, setFollowState] = useState<'visible' | 'checked' | 'hidden'>('visible');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const reducedMotion = useReducedMotion();
  const { toggleFollow, checkFollowStatus } = useFollowMutations();
  const { toggleLike, toggleSave, incrementShare } = useVideoMutations();
  const { user } = useUser();

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

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isVisible && getAutoplaySetting()) {
      videoElement.play().catch(() => {
        // Auto-play failed, which is expected in many browsers
      });
    } else {
      videoElement.pause();
    }
  }, [isVisible]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please login to like videos');
      return;
    }
    setIsLiked(!isLiked);
    if (video.id) {
      await toggleLike(String(video.id));
    }
  };

  const handleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info('Comments coming soon');
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowShareMenu(true);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please login to save videos');
      return;
    }
    setIsSaved(!isSaved);
    if (video.id) {
      await toggleSave(String(video.id));
    }
  };

  return (
    <div 
      className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden cursor-pointer"
      onClick={onVideoClick}
    >
      {/* Video element with autoplay */}
      <video
        ref={videoRef}
        src={video.url}
        poster={video.thumbnail}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        onClick={onVideoClick}
      />
      
      {/* Enhanced loading overlay */}
      {!isVisible && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/40 flex items-center justify-center">
          <div className="relative">
            {/* Outer pulse ring */}
            <div className="absolute inset-0 w-20 h-20 bg-card/20 rounded-full animate-ping" />
            {/* Main play button */}
            <div className="relative w-16 h-16 bg-card/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl border border-white/30">
              <div className="w-0 h-0 border-l-[16px] border-l-gray-800 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
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
                className="font-semibold text-white cursor-pointer hover:underline"
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

      {/* Action buttons - right side with consistent styling */}
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
            {/* Like animation pulse */}
            {isLiked && (
              <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
            )}
          </div>
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {formatCount(video.stats.likes + (isLiked ? 1 : 0))}
          </span>
        </button>

        <button
          onClick={handleComment}
          aria-label={`Comment on video by ${video.user.name}`}
          className="group flex flex-col items-center gap-1 transition-all duration-200 active:bg-transparent"
        >
          <div className="p-3 bg-card/15 border border-white/20 rounded-full backdrop-blur-md hover:bg-card/25 transition-all duration-200 group-active:scale-95 shadow-lg active:bg-card/15">
            <MessageCircle className="size-6 text-white group-active:text-primary transition-colors" />
          </div>
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {formatCount(video.stats.comments)}
          </span>
        </button>

        <button
          onClick={handleShare}
          aria-label={`Share video by ${video.user.name}`}
          className="group flex flex-col items-center gap-1 transition-all duration-200 active:bg-transparent"
        >
          <div className="p-3 bg-card/15 border border-white/20 rounded-full backdrop-blur-md hover:bg-card/25 transition-all duration-200 group-active:scale-95 shadow-lg active:bg-card/15">
            <Share className="size-6 text-white group-active:text-primary transition-colors" />
          </div>
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {formatCount(video.stats.shares)}
          </span>
        </button>

        <button
          onClick={handleSave}
          aria-label={`Save video by ${video.user.name}`}
          className="group flex flex-col items-center gap-1 transition-all duration-200"
        >
          <div className={cn(
            "p-3 rounded-full backdrop-blur-md border transition-all duration-200 group-active:scale-95 shadow-lg",
            isSaved
              ? "bg-primary/20 border-primary/30"
              : "bg-card/15 border-white/20 hover:bg-card/25"
          )}>
            <Bookmark className={cn(
              "size-6 transition-all duration-200",
              isSaved ? "fill-primary text-primary" : "text-white"
            )} />
          </div>
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {formatCount(video.stats.saves + (isSaved ? 1 : 0))}
          </span>
        </button>
      </div>

      {/* Mute toggle - top right with consistent styling */}
      <button
        onClick={handleMute}
        aria-label={`${isMuted ? 'Unmute' : 'Mute'} video`}
        className="absolute top-4 right-4 p-3 bg-card/15 border border-white/20 rounded-full backdrop-blur-md text-white hover:bg-card/25 transition-all duration-200 active:scale-95 shadow-lg"
      >
        {isMuted ? (
          <svg className="size-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.794L4.293 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.293l4.09-3.794a1 1 0 011.617.794zM7 8H2v4h5V8zm1 0v4l3 2.794V5.206L8 8zm8.707-2.293a1 1 0 00-1.414 1.414L16.586 9l-1.293 1.293a1 1 0 101.414 1.414L18 10.414l1.293 1.293a1 1 0 001.414-1.414L19.414 9l1.293-1.293a1 1 0 00-1.414-1.414L18 7.586l-1.293-1.293z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="size-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.794L4.293 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.293l4.09-3.794a1 1 0 011.617.794zM7 8H2v4h5V8zm1 0v4l3 2.794V5.206L8 8zm7.293-.707a1 1 0 011.414 0L18 8.586l1.293-1.293a1 1 0 111.414 1.414L19.414 10l1.293 1.293a1 1 0 01-1.414 1.414L18 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L16.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </button>

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
};