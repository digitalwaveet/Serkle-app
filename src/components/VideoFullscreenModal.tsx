import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Heart, MessageCircle, Share, Bookmark, Music } from 'lucide-react';
import { Video } from '@/hooks/useVideoFeed';
import { useVideoMutations } from '@/hooks/useVideoMutations';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import FooterNav from './FooterNav';
import { CommentsModal } from './CommentsModal';
import { useVideoVirtualization } from '@/hooks/useVideoVirtualization';
import { useVideoPrebuffering } from '@/hooks/useVideoPrebuffering';
import { useVisibilityHandler } from '@/hooks/useVisibilityHandler';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { UnifiedVideoPlayer } from './UnifiedVideoPlayer';
import { VideoShareMenu } from './VideoShareMenu';

interface VideoFullscreenModalProps {
  video: Video;
  videos: Video[];
  isOpen: boolean;
  onClose: () => void;
  activeTab?: "home" | "circles" | "add" | "ask" | "safe";
  onTabSelect?: (key: "home" | "circles" | "add" | "ask" | "safe") => void;
  onOpenCreate?: () => void;
}

const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const HeartBurst: React.FC<{ show: boolean; onComplete: () => void }> = ({ show, onComplete }) => {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (show && !reducedMotion) {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    } else if (show && reducedMotion) {
      onComplete();
    }
  }, [show, onComplete, reducedMotion]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div 
        className={cn(
          "text-red-500",
          reducedMotion 
            ? "opacity-100" 
            : "animate-bounce-in"
        )}
        style={{
          animation: reducedMotion ? 'none' : 'bounce-in 1s ease-out forwards'
        }}
      >
        <Heart className="size-24 fill-current drop-shadow-lg" />
      </div>
    </div>
  );
};

export const VideoFullscreenModal: React.FC<VideoFullscreenModalProps> = ({
  video: initialVideo,
  videos,
  isOpen,
  onClose,
  activeTab = "home",
  onTabSelect = () => {},
  onOpenCreate = () => {},
}) => {
  const initialIndex = videos.findIndex(v => v.id === initialVideo.id);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const { toggleLike, toggleSave } = useVideoMutations();
  const [lastTap, setLastTap] = useState(0);
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [shareVideoId, setShareVideoId] = useState<string | null>(null);
  const [shareVideoUrl, setShareVideoUrl] = useState<string>('');
  const [commentModalHeight, setCommentModalHeight] = useState(60);
  const containerRef = useRef<HTMLDivElement>(null);
  const allVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const reducedMotion = useReducedMotion();

  const { 
    currentIndex, 
    visibleVideos, 
    setCurrentIndex,
    goToNext,
    goToPrevious
  } = useVideoVirtualization({ videos, initialIndex });

  const { 
    registerVideo, 
    getPreloadStrategy, 
    shouldDetachSrc, 
    updateVideoPrebuffering 
  } = useVideoPrebuffering({ currentIndex, videos });

  const currentVideo = videos[currentIndex];
  const [isLiked, setIsLiked] = useState(currentVideo?.liked || false);
  const [isSaved, setIsSaved] = useState(currentVideo?.saved || false);

  // Update like/save state when video changes
  useEffect(() => {
    if (currentVideo) {
      setIsLiked(currentVideo.liked);
      setIsSaved(currentVideo.saved);
    }
  }, [currentVideo]);

  // Handle page visibility changes
  const handleVisibilityChange = useCallback((isVisible: boolean) => {
    allVideoRefs.current.forEach((video, index) => {
      if (isVisible && index === currentIndex) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [currentIndex]);

  useVisibilityHandler({ onVisibilityChange: handleVisibilityChange });

  // Swipe gestures for navigation - close comments on swipe down when comments are open
  const swipeHandlers = useSwipeGestures({
    onSwipeUp: goToNext,
    onSwipeDown: showComments ? () => setShowComments(false) : goToPrevious,
  }, { 
    threshold: 50 
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goToNext();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case ' ':
          e.preventDefault();
          // Toggle play/pause for current video
          const currentVideoEl = allVideoRefs.current.get(currentIndex);
          if (currentVideoEl) {
            if (currentVideoEl.paused) {
              currentVideoEl.play().catch(() => {});
            } else {
              currentVideoEl.pause();
            }
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Lock background scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, goToNext, goToPrevious, onClose, currentIndex]);

  // Update prebuffering when current index changes
  useEffect(() => {
    updateVideoPrebuffering();
  }, [currentIndex, updateVideoPrebuffering]);

  // Pause video when comments are open
  useEffect(() => {
    const currentVideoEl = allVideoRefs.current.get(currentIndex);
    if (currentVideoEl) {
      if (showComments) {
        currentVideoEl.pause();
      } else {
        currentVideoEl.play().catch(() => {});
      }
    }
  }, [showComments, currentIndex]);

  // Handle infinite scroll with enhanced intersection observer
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisibleIndex = 0;

        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const index = parseInt(entry.target.getAttribute('data-video-index') || '0');
            mostVisibleIndex = index;
          }
        });

        if (maxRatio > 0.5) {
          setCurrentIndex(mostVisibleIndex);
        }
      },
      {
        root: containerRef.current,
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: '30% 0px 30% 0px'
      }
    );

    const videoElements = containerRef.current.querySelectorAll('[data-video-index]');
    videoElements.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [visibleVideos, setCurrentIndex]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const timeDiff = now - lastTap;
    
    if (timeDiff < 300 && timeDiff > 0) {
      // Double tap detected
      e.preventDefault();
      setIsLiked(true);
      if (!reducedMotion) {
        setShowHeartBurst(true);
      }
    }
    
    setLastTap(now);
  }, [lastTap, reducedMotion]);

  const handleRegisterVideo = useCallback((index: number, element: HTMLVideoElement | null) => {
    if (element) {
      allVideoRefs.current.set(index, element);
    } else {
      allVideoRefs.current.delete(index);
    }
    registerVideo(index, element);
  }, [registerVideo]);

  const handleHeartBurstComplete = useCallback(() => {
    setShowHeartBurst(false);
  }, []);

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentVideo) return;
    
    setIsLiked(!isLiked);
    try {
      await toggleLike(currentVideo.id);
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLiked(isLiked);
    }
  }, [isLiked, currentVideo, toggleLike]);

  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentVideo) return;
    
    setIsSaved(!isSaved);
    try {
      await toggleSave(currentVideo.id);
    } catch (error) {
      console.error('Error toggling save:', error);
      setIsSaved(isSaved);
    }
  }, [isSaved, currentVideo, toggleSave]);

  const handleAction = useCallback((action: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (action === 'comment') {
      setShowComments(true);
    }
    // Handle other actions
  }, []);

  if (!isOpen || !currentVideo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video container with virtualized scrolling */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto snap-y snap-mandatory"
        style={{ 
          scrollSnapType: 'y mandatory',
          height: showComments ? `${100 - commentModalHeight}vh` : 'calc(100vh - 54px)',
          paddingBottom: '54px'
        }}
        {...swipeHandlers}
      >
        {visibleVideos.map(({ video, index, isCurrent, isAdjacent }) => (
          <div
            key={`${video.id}-${index}`}
            data-video-index={index}
            className="relative w-full snap-start snap-always flex items-center justify-center bg-black"
            style={{ 
              height: showComments ? `${100 - commentModalHeight}vh` : 'calc(100vh - 54px)',
              transform: `translateY(${(index - currentIndex) * 100}vh)`
            }}
            onClick={handleDoubleClick}
          >
            <div className="w-full h-full relative bg-black overflow-hidden">
              {/* Optimized video element with prebuffering */}
              <UnifiedVideoPlayer
                video={video}
                isActive={isCurrent}
                index={index}
              />

            {/* Heart burst animation */}
            <HeartBurst 
              show={showHeartBurst && isCurrent} 
              onComplete={handleHeartBurstComplete} 
            />

              {/* Video info overlay - only show for current video and when comments are not open */}
              {isCurrent && !showComments && (
                <>
                  {/* User info - bottom left */}
                  <div className="absolute bottom-4 left-4 right-20 text-white">
                  {expandedCaption ? (
                    /* Expanded caption mode with dynamic height */
                    <div 
                      className="relative cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCaption(false);
                      }}
                    >
                      <div 
                        className="overflow-y-auto"
                        style={{
                          maxHeight: 'min(50vh, calc(100vh - 200px))',
                          height: 'auto'
                        }}
                        onScroll={(e) => {
                          const scrollTop = e.currentTarget.scrollTop;
                          const maxScroll = e.currentTarget.scrollHeight - e.currentTarget.clientHeight;
                          const midpoint = maxScroll * 0.5;
                          
                          // Update profile position based on scroll
                          const profileElement = e.currentTarget.querySelector('[data-profile]') as HTMLElement;
                          if (profileElement) {
                            if (scrollTop >= midpoint) {
                              profileElement.style.position = 'sticky';
                              profileElement.style.top = '0';
                            } else {
                              profileElement.style.position = 'relative';
                              profileElement.style.top = 'auto';
                            }
                          }
                        }}
                      >
                        {/* Profile info that can stick */}
                        <div 
                          data-profile
                          className="flex items-center gap-2 mb-2 p-2 rounded-lg transition-all duration-300"
                        >
                          <div 
                            className="size-8 rounded-full flex items-center justify-center text-xs font-medium text-white border border-white/30"
                            style={{ backgroundColor: video.user.avatarColor }}
                          >
                            {video.user.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-semibold text-white">{video.user.name}</span>
                              {video.user.verified && (
                                <div className="size-3 bg-card rounded-full flex items-center justify-center">
                                  <div className="size-1.5 bg-primary rounded-full" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Caption content with dynamic height */}
                        <div className="space-y-3 pb-4">
                          <h3 className="font-semibold text-white text-sm">{video.title}</h3>
                          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{video.description}</p>
                          {video.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {video.tags.map((tag) => (
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
                      </div>
                    </div>
                  ) : (
                    /* Collapsed caption mode */
                    <>
                      {/* Profile info */}
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="size-8 rounded-full flex items-center justify-center text-xs font-medium text-white border border-white/30"
                          style={{ backgroundColor: video.user.avatarColor }}
                        >
                          {video.user.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold text-white">{video.user.name}</span>
                            {video.user.verified && (
                              <div className="size-3 bg-card rounded-full flex items-center justify-center">
                                <div className="size-1.5 bg-primary rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Caption area */}
                      <div className="mb-2">
                        <div className="flex items-start gap-2">
                          <h3 className="font-semibold text-white text-sm">{video.title}</h3>
                          {video.description && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCaption(true);
                              }}
                              className="text-white/60 text-sm hover:text-white/80 transition-colors whitespace-nowrap"
                            >
                              ...more
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Tags when caption is collapsed */}
                      {video.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {video.tags.slice(0, 2).map((tag) => (
                            <span 
                              key={tag}
                              className="text-xs px-2 py-1 bg-card/20 text-white rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                  {/* Action buttons - right side */}
                  <div className="absolute right-3 bottom-4 flex flex-col gap-3 max-h-[calc(50vh-32px)] justify-end">
                  <button
                    onClick={handleLike}
                    aria-label={`${isLiked ? 'Unlike' : 'Like'} video by ${video.user.name}`}
                    className={cn(
                      "flex flex-col items-center gap-1 text-white transition-colors",
                      isLiked && "text-red-500"
                    )}
                  >
                    <div className="p-2.5 bg-card/20 rounded-full backdrop-blur-sm">
                      <Heart 
                        className={cn(
                          "size-5",
                          isLiked && "fill-current"
                        )} 
                      />
                    </div>
                    <span className="text-xs font-medium">
                      {formatCount(video.stats.likes + (isLiked ? 1 : 0))}
                    </span>
                  </button>

                  <button
                    onClick={handleAction('comment')}
                    aria-label={`Comment on video by ${video.user.name}`}
                    className="flex flex-col items-center gap-1 text-white"
                  >
                    <div className="p-2.5 bg-card/20 rounded-full backdrop-blur-sm">
                      <MessageCircle className="size-5" />
                    </div>
                    <span className="text-xs font-medium">
                      {formatCount(video.stats.comments)}
                    </span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareVideoId(video.id);
                      setShareVideoUrl(video.url);
                    }}
                    aria-label={`Share video by ${video.user.name}`}
                    className="flex flex-col items-center gap-1 text-white"
                  >
                    <div className="p-2.5 bg-card/20 rounded-full backdrop-blur-sm">
                      <Share className="size-5" />
                    </div>
                    <span className="text-xs font-medium">
                      {formatCount(video.stats.shares)}
                    </span>
                  </button>

                  <button
                    onClick={handleSave}
                    aria-label={`${isSaved ? 'Unsave' : 'Save'} video by ${video.user.name}`}
                    className={cn(
                      "flex flex-col items-center gap-1 text-white transition-colors",
                      isSaved && "text-yellow-500"
                    )}
                  >
                    <div className="p-2.5 bg-card/20 rounded-full backdrop-blur-sm">
                      <Bookmark 
                        className={cn(
                          "size-5",
                          isSaved && "fill-current"
                        )} 
                      />
                    </div>
                    <span className="text-xs font-medium">
                      {formatCount(video.stats.saves + (isSaved ? 1 : 0))}
                    </span>
                  </button>

                  {/* Music Circle */}
                  <button
                    onClick={handleAction('music')}
                    aria-label="View music used in video"
                    className="flex flex-col items-center gap-1 text-white"
                  >
                    <div className="size-10 bg-card/20 rounded-full backdrop-blur-sm flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 rounded-full border border-white/30 animate-spin" style={{ animationDuration: '3s' }}>
                        <div className="absolute top-0.5 left-1/2 transform -translate-x-1/2 size-0.5 bg-card rounded-full"></div>
                      </div>
                      <Music className="size-4 text-white" />
                    </div>
                  </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer Navigation overlaid on video */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <FooterNav
          active={activeTab}
          onSelect={onTabSelect}
          onOpenCreate={onOpenCreate}
          videoMode={true}
        />
      </div>

      {/* Comments Modal */}
      <CommentsModal
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        videoId={currentVideo.id}
        videoTitle={currentVideo.title}
        totalComments={currentVideo.stats.comments}
        onHeightChange={setCommentModalHeight}
        videoOwnerId={currentVideo.user?.id}
        videoOwnerName={currentVideo.user?.name}
      />

      {shareVideoId && (
        <VideoShareMenu
          isOpen={!!shareVideoId}
          onClose={() => {
            setShareVideoId(null);
            setShareVideoUrl('');
          }}
          videoId={shareVideoId}
          videoUrl={shareVideoUrl}
        />
      )}
    </div>
  );
};