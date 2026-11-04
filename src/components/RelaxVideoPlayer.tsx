import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Heart, MessageCircle, Share, Bookmark, Volume2, VolumeX, Plus, Check } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useFollowMutations } from '@/hooks/useFollowMutations';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PublicProfileModal from '@/components/PublicProfileModal';
import { VideoShareMenu } from '@/components/VideoShareMenu';
import FooterNav from './FooterNav';
import { CommentsModal } from './CommentsModal';
import { DraggablePipVideo } from './DraggablePipVideo';
import { type TabKey } from '@/hooks/useAppNav';
import { useVideoFeed } from '@/hooks/useVideoFeed';
import { useVideoMutations } from '@/hooks/useVideoMutations';

export interface RelaxVideoPlayerProps {
  onBackToFeed?: () => void;
  onRefresh?: () => void;
  activeTab?: TabKey;
  onTabSelect?: (key: TabKey) => void;
  onOpenCreate?: () => void;
  initialVideoId?: string;
  initialOpenComments?: boolean;
}

const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

export const RelaxVideoPlayer: React.FC<RelaxVideoPlayerProps> = ({ 
  onBackToFeed,
  onRefresh = () => {},
  activeTab = "home",
  onTabSelect = () => {},
  onOpenCreate = () => {},
  initialVideoId,
  initialOpenComments = false
}) => {
  // Fetch videos from database
  const { videos: relaxVideosRaw, loading: videosLoading, hasMore, loadMore, refetch } = useVideoFeed();
  const relaxVideos = relaxVideosRaw ?? [];
  const { toggleLike, toggleSave, incrementShare } = useVideoMutations();
  const { toggleFollow, checkFollowStatus } = useFollowMutations();
  const { user } = useUser();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [followStates, setFollowStates] = useState<Record<string, 'visible' | 'checked' | 'hidden'>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [landscapeVideos, setLandscapeVideos] = useState<Set<string>>(new Set());
  const [pausedVideos, setPausedVideos] = useState<Set<string>>(new Set());
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set());
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [pipVideoIndex, setPipVideoIndex] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [shareVideoId, setShareVideoId] = useState<string | null>(null);
  const [shareVideoUrl, setShareVideoUrl] = useState<string>('');
  const [doubleTapHearts, setDoubleTapHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const { triggerHaptic } = useHapticFeedback();

  const videoHeight = window.innerHeight - 50; // Account for 50px footer navbar

  // Scroll to initial video when loaded
  useEffect(() => {
    if (initialVideoId && relaxVideos.length > 0) {
      const idx = relaxVideos.findIndex(v => v.id === initialVideoId);
      if (idx > 0) {
        setCurrentIndex(idx);
        if (containerRef.current) {
          containerRef.current.scrollTo({ top: idx * videoHeight, behavior: 'instant' });
        }
      }
      // Auto-open comments if requested
      if (initialOpenComments) {
        setIsCommentsOpen(true);
        setPipVideoIndex(initialVideoId);
      }
    }
  }, [initialVideoId, initialOpenComments, relaxVideos.length, videoHeight]);

  // Check initial follow status for all videos
  useEffect(() => {
    const checkAllFollowStatuses = async () => {
      if (!user || !relaxVideos || relaxVideos.length === 0) return;
      
      const newFollowStates: Record<string, 'visible' | 'checked' | 'hidden'> = {};
      for (const video of relaxVideos) {
        if (video?.user?.id && user.id !== video.user.id) {
          const following = await checkFollowStatus(video.user.id);
          if (following) {
            newFollowStates[video.user.id] = 'hidden';
          }
        }
      }
      setFollowStates(prev => ({ ...prev, ...newFollowStates }));
    };
    checkAllFollowStatuses();
  }, [relaxVideos, user, checkFollowStatus]);

  // Register video elements and handle their lifecycle
  const registerVideo = useCallback((videoId: string, element: HTMLVideoElement | null) => {
    if (element) {
      videoRefs.current.set(videoId, element);
      
      // Set video properties
      const videoIndex = relaxVideos.findIndex(v => v.id === videoId);
      const video = relaxVideos[videoIndex];
      if (video && element.src !== video.url) {
        element.src = video.url;
        element.muted = isMuted;
        element.preload = Math.abs(videoIndex - currentIndex) <= 1 ? 'auto' : 'metadata';
        
        // Add event listeners for loading states
        const handleLoadStart = () => setIsLoading(prev => ({ ...prev, [videoId]: true }));
        const handleCanPlay = () => setIsLoading(prev => ({ ...prev, [videoId]: false }));
        const handleWaiting = () => setIsLoading(prev => ({ ...prev, [videoId]: true }));
        const handlePlaying = () => {
          setIsLoading(prev => ({ ...prev, [videoId]: false }));
          setPausedVideos(prev => {
            const next = new Set(prev);
            next.delete(videoId);
            return next;
          });
        };
        const handlePause = () => {
          setPausedVideos(prev => new Set(prev).add(videoId));
        };
        const handleEnded = () => {
          setPausedVideos(prev => new Set(prev).add(videoId));
        };
        const handleLoadedMetadata = () => {
          if (element.videoWidth > element.videoHeight) {
            setLandscapeVideos(prev => new Set(prev).add(videoId));
          }
        };
        
        element.addEventListener('loadstart', handleLoadStart);
        element.addEventListener('canplay', handleCanPlay);
        element.addEventListener('waiting', handleWaiting);
        element.addEventListener('playing', handlePlaying);
        element.addEventListener('pause', handlePause);
        element.addEventListener('ended', handleEnded);
        element.addEventListener('loadedmetadata', handleLoadedMetadata);
        
        // Store cleanup function
        element.dataset.cleanup = 'true';
      }
    } else {
      videoRefs.current.delete(videoId);
    }
  }, [relaxVideos, currentIndex, isMuted]);

  // Handle video playback state changes
  useEffect(() => {
    const currentVideo = relaxVideos[currentIndex];
    if (!currentVideo) return;

    videoRefs.current.forEach((video, videoId) => {
      if (videoId === currentVideo.id) {
        // Play current video
        video.currentTime = 0; // Reset to beginning
        video.play().catch(() => {
          console.log('Auto-play prevented for video', videoId);
        });
      } else {
        // Pause other videos
        video.pause();
      }
    });
  }, [currentIndex, relaxVideos]);

  // Handle mute/unmute for all videos
  useEffect(() => {
    videoRefs.current.forEach((video) => {
      video.muted = isMuted;
    });
  }, [isMuted]);

  // Touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isTransitioning) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, [isTransitioning]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isTransitioning) return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    const deltaY = touchEndY - touchStartY.current;
    const deltaTime = touchEndTime - touchStartTime.current;
    const velocity = Math.abs(deltaY) / deltaTime;

    // Pull-to-refresh at the top
    if (currentIndex === 0 && deltaY > 120 && velocity > 0.5) {
      onRefresh();
      return;
    }

    // Navigate between videos
    const videoCount = relaxVideos?.length || 0;
    if (Math.abs(deltaY) > 80 && velocity > 0.4 && deltaTime < 500) {
      setIsTransitioning(true);
      
      if (deltaY < 0 && currentIndex < videoCount - 1) {
        // Swipe up - next video
        setCurrentIndex(prev => prev + 1);
        
        // Load more if near the end
        if (currentIndex >= videoCount - 3 && hasMore) {
          loadMore();
        }
      } else if (deltaY > 0 && currentIndex > 0) {
        // Swipe down - previous video
        setCurrentIndex(prev => prev - 1);
      }
      
      // Reset transition state
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, relaxVideos?.length, onRefresh, isTransitioning]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setIsTransitioning(true);
            setCurrentIndex(prev => prev - 1);
            setTimeout(() => setIsTransitioning(false), 300);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < (relaxVideos?.length || 0) - 1) {
            setIsTransitioning(true);
            setCurrentIndex(prev => prev + 1);
            setTimeout(() => setIsTransitioning(false), 300);
          }
          break;
        case 'Escape':
          if (onBackToFeed) onBackToFeed();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, relaxVideos?.length, isTransitioning, onBackToFeed]);

  const handleFollow = useCallback(async (userId: string) => {
    if (!user) {
      toast.error('Please login to follow users');
      return;
    }
    const currentState = followStates[userId] || 'visible';
    if (currentState === 'visible') {
      const followed = await toggleFollow(userId);
      if (followed) {
        setFollowStates(prev => ({ ...prev, [userId]: 'checked' }));
        setFollowedUsers(prev => new Set([...prev, userId]));
        setTimeout(() => {
          setFollowStates(prev => ({ ...prev, [userId]: 'hidden' }));
        }, 1500);
        triggerHaptic('success');
      }
    }
  }, [followStates, triggerHaptic, toggleFollow, user]);

  // Action handlers
  const handleLike = useCallback(async (videoId: string) => {
    // Optimistic update
    setLikedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
    triggerHaptic('light');
    
    // Database update
    await toggleLike(videoId);
  }, [triggerHaptic, toggleLike]);

  const handleMute = useCallback(() => {
    setIsMuted(!isMuted);
    triggerHaptic('light');
  }, [isMuted, triggerHaptic]);

  const togglePlayPause = useCallback((videoId: string) => {
    const video = videoRefs.current.get(videoId);
    if (!video) return;
    
    if (video.paused) {
      video.play().catch(e => console.log('Error playing video:', e));
    } else {
      video.pause();
    }
    triggerHaptic('light');
  }, [triggerHaptic]);

  // Double-tap to like handler
  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent, videoId: string) => {
    const now = Date.now();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.changedTouches?.[0]?.clientX ?? 0;
      clientY = e.changedTouches?.[0]?.clientY ?? 0;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const timeDiff = now - lastTapRef.current.time;
    const distX = Math.abs(clientX - lastTapRef.current.x);
    const distY = Math.abs(clientY - lastTapRef.current.y);

    if (timeDiff < 300 && distX < 50 && distY < 50) {
      // Double tap detected — like the video (only add, don't unlike)
      const isLiked = likedVideos.has(videoId);
      if (!isLiked) {
        handleLike(videoId);
      }

      // Show heart animation at tap position
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const heartId = Date.now();
      setDoubleTapHearts(prev => [...prev, { id: heartId, x, y }]);
      triggerHaptic('success');

      // Remove heart after animation
      setTimeout(() => {
        setDoubleTapHearts(prev => prev.filter(h => h.id !== heartId));
      }, 1000);

      lastTapRef.current = { time: 0, x: 0, y: 0 };
    } else {
      lastTapRef.current = { time: now, x: clientX, y: clientY };
    }
  }, [likedVideos, handleLike, triggerHaptic]);

  // Combined tap handler for single-tap (play/pause) and double-tap (like)
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent, videoId: string) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current.time;
    
    // Extract position for potential double tap heart
    let clientX: number, clientY: number;
    if ('touches' in e) {
      const touch = e.nativeEvent instanceof TouchEvent ? e.nativeEvent.changedTouches[0] : (e as any).changedTouches?.[0] || (e as any).touches?.[0];
      clientX = touch?.clientX ?? 0;
      clientY = touch?.clientY ?? 0;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    if (timeDiff < 300) {
      // Double tap detected
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      
      // Handle heart animation and like logic
      handleDoubleTap(e, videoId);
      lastTapRef.current = { time: 0, x: 0, y: 0 };
    } else {
      // Potential single tap - wait to see if it's a double tap
      lastTapRef.current = { 
        time: now, 
        x: clientX,
        y: clientY
      };
      
      tapTimeoutRef.current = setTimeout(() => {
        togglePlayPause(videoId);
        tapTimeoutRef.current = null;
        lastTapRef.current = { time: 0, x: 0, y: 0 };
      }, 300);
    }
  }, [handleDoubleTap, togglePlayPause, triggerHaptic]);

  const handleAction = useCallback(async (action: string, videoId?: string) => {
    console.log(`${action} action triggered`);
    triggerHaptic('light');
    
    if (action === 'save' && videoId) {
      await toggleSave(videoId);
    } else if (action === 'share' && videoId) {
      await incrementShare(videoId);
      // Trigger native share if available
      if (navigator.share) {
        navigator.share({
          title: relaxVideos.find(v => v.id === videoId)?.title,
          url: window.location.href
        });
      }
    }
  }, [triggerHaptic, toggleSave, incrementShare, relaxVideos]);

  const toggleCaptionExpansion = useCallback((videoId: string) => {
    setExpandedCaptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
    triggerHaptic('light');
  }, [triggerHaptic]);

  const needsReadMore = useCallback((text: string | null | undefined) => {
    // More aggressive check - trigger read more for descriptions longer than 100 characters
    return (text ?? '').length > 100;
  }, []);

  // Calculate which videos to render (current + adjacent for smooth scrolling)
  const getVisibleVideos = () => {
    if (!relaxVideos || relaxVideos.length === 0) return [];
    const visible = [];
    for (let i = Math.max(0, currentIndex - 1); i <= Math.min(relaxVideos.length - 1, currentIndex + 1); i++) {
      visible.push(i);
    }
    return visible;
  };

  const visibleVideoIndices = getVisibleVideos();

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Video container */}
      <div 
        ref={containerRef}
        className={`relative w-full overflow-hidden transition-all duration-300 ${
          isCommentsOpen ? 'blur-[8px] brightness-[0.3]' : ''
        }`}
        style={{ 
          height: 'calc(100vh - 50px)', // Leave space for footer navbar
          touchAction: 'none' 
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {visibleVideoIndices.map((index) => {
          const video = relaxVideos[index];
          if (!video) return null;
          const translateY = (index - currentIndex) * videoHeight;
          const isActive = index === currentIndex;
          const isLiked = video.liked || likedVideos.has(video.id);
          const videoIsLoading = isLoading[video.id] || false;
          
          return (
            <div
              key={`relax-video-${index}-${video.id}`}
              className="absolute inset-0 w-full h-full"
              style={{
                transform: `translateY(${translateY}px)`,
                transition: isTransitioning ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
                willChange: 'transform',
                zIndex: isActive ? 20 : 10
              }}
            >
              {/* Gradient background for landscape videos only */}
              {landscapeVideos.has(video.id) && (
                <div className="absolute inset-0 bg-gradient-to-b from-primary via-secondary to-primary" />
              )}

              {/* Video element */}
              <video
                ref={(el) => registerVideo(video.id, el)}
                className={`relative w-full h-full z-[1] ${
                  landscapeVideos.has(video.id) ? 'object-contain' : 'object-cover'
                }`}
                poster={video.thumbnail}
                loop
                playsInline
                muted={isMuted}
              />

              {/* Tap zone for play/pause and like */}
              <div
                className="absolute inset-0 z-10"
                onClick={(e) => handleTap(e, video.id)}
              />

              {/* Play icon overlay */}
              {isActive && pausedVideos.has(video.id) && !videoIsLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-all duration-300">
                  <div className="size-20 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-2xl animate-in zoom-in-75 duration-200">
                    <div className="w-0 h-0 border-l-[24px] border-l-white border-t-[16px] border-t-transparent border-b-[16px] border-b-transparent ml-1.5 opacity-90" />
                  </div>
                </div>
              )}

              {/* Double-tap heart animations */}
              {doubleTapHearts.map(heart => (
                <div
                  key={heart.id}
                  className="absolute z-30 pointer-events-none"
                  style={{ left: heart.x - 36, top: heart.y - 36 }}
                >
                  <Heart
                    className="w-[72px] h-[72px] fill-red-500 text-red-500 animate-double-tap-heart drop-shadow-lg"
                  />
                </div>
              ))}

              {/* Enhanced loading indicator */}
              {videoIsLoading && isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-radial from-black/30 via-black/20 to-transparent">
                  <SerkleLoader dark label="Buffering video" />
                </div>
              )}

              {/* Video info overlay - only for active video */}
              {isActive && (
                <>
                  {(() => {
                    const isExpanded = expandedCaptions.has(video.id);
                    const showReadMore = needsReadMore(video.description);
                    
                    return (
                      <div 
                        className="absolute left-4 right-20 text-white z-20 transition-all duration-300 ease-out"
                        style={{ 
                          bottom: '8px',
                          transform: isExpanded ? 'translateY(-20px)' : 'translateY(0)'
                        }}
                      >
                        {/* User info - pushes up when caption expands */}
                        <div className="flex items-center gap-3 mb-2">
                          <div className="relative">
                            <div 
                              className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold overflow-hidden"
                              style={{ backgroundColor: video.user.avatarColor }}
                            >
                              {video.user.avatar ? (
                                <img src={video.user.avatar} alt={video.user.name} className="w-full h-full object-cover" />
                              ) : (
                                video.user.initials
                              )}
                            </div>
                            {/* Follow button */}
                            {(followStates[video.user.id] || 'visible') !== 'hidden' && user?.id !== video.user.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFollow(video.user.id);
                                }}
                                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-card border-2 border-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 z-10"
                                aria-label={`Follow ${video.user.name}`}
                              >
                                {(followStates[video.user.id] || 'visible') === 'visible' ? (
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
                                setSelectedUserId(video.user.id);
                                setShowProfileModal(true);
                              }}
                            >
                              {video.user.name}
                            </p>
                            <p className="text-xs opacity-80">@{video.user.username}</p>
                          </div>
                        </div>
                        
                        {/* Title */}
                        {video.title && (
                          <h3 className="font-semibold text-sm mb-1 line-clamp-1 drop-shadow-sm">{video.title}</h3>
                        )}

                        {/* Caption with expandable functionality */}
                        <div className="mb-1">
                          {!isExpanded ? (
                            /* Collapsed state - 2 lines with Read More button */
                            <div className="text-sm leading-relaxed">
                              <p className="line-clamp-2 mb-1">
                                {video.description}
                              </p>
                              {showReadMore && (
                                <button
                                  onClick={() => toggleCaptionExpansion(video.id)}
                                  className="text-white font-bold text-sm hover:text-gray-200 transition-colors"
                                >
                                  Read More
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Expanded state - full text */
                            <div>
                              <p 
                                className="text-sm leading-relaxed cursor-pointer transition-all duration-300"
                                onClick={() => toggleCaptionExpansion(video.id)}
                              >
                                {video.description}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Tags - always visible */}
                        {video.tags && video.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {video.tags.slice(0, 4).map((tag, tagIndex) => (
                              <span 
                                key={tagIndex} 
                                className="text-xs text-white bg-card/10 backdrop-blur-md border border-white/20 rounded-full px-2 py-0.5 shadow-sm"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Action buttons - positioned at bottom edge */}
                  <div className="absolute right-2 flex flex-col items-center gap-3 z-20" style={{ bottom: '8px', maxWidth: '48px' }}>
                    {/* Like button with enhanced styling */}
                    <button 
                      onClick={() => handleLike(video.id)}
                      className="group flex flex-col items-center gap-1 transition-all duration-200"
                    >
                      <div className={cn(
                        "relative w-10 h-10 rounded-full backdrop-blur-md border transition-all duration-200 flex items-center justify-center group-active:scale-95 shadow-lg",
                        isLiked 
                          ? "bg-red-500/20 border-red-500/30 shadow-red-500/25" 
                          : "bg-card/15 border-white/20 hover:bg-card/25"
                      )}>
                        <Heart 
                          className={cn(
                            "w-6 h-6 transition-all duration-200",
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
                      <span className="text-white text-xs font-medium drop-shadow-sm">
                        {formatCount(video.stats.likes + (isLiked ? 1 : 0))}
                      </span>
                    </button>

                    <button 
                      onClick={() => {
                        setIsCommentsOpen(true);
                        setPipVideoIndex(video.id);
                        triggerHaptic('light');
                      }}
                      className="group flex flex-col items-center gap-1 transition-all duration-200 active:bg-transparent"
                    >
                       <div className="w-10 h-10 rounded-full bg-card/15 backdrop-blur-md border border-white/20 flex items-center justify-center group-active:scale-95 hover:bg-card/25 transition-all duration-200 shadow-lg active:bg-card/15">
                        <MessageCircle className="w-6 h-6 text-white group-active:text-primary transition-colors" />
                      </div>
                      <span className="text-white text-xs font-medium drop-shadow-sm">
                        {formatCount(video.stats.comments)}
                      </span>
                    </button>

                    {/* Share button with enhanced styling */}
                    <button 
                      onClick={() => {
                        setShareVideoId(video.id);
                        setShareVideoUrl(video.url);
                      }}
                      className="group flex flex-col items-center gap-1 transition-all duration-200 active:bg-transparent"
                    >
                      <div className="w-10 h-10 rounded-full bg-card/15 backdrop-blur-md border border-white/20 flex items-center justify-center group-active:scale-95 hover:bg-card/25 transition-all duration-200 shadow-lg active:bg-card/15">
                        <Share className="w-6 h-6 text-white group-active:text-primary transition-colors" />
                      </div>
                      <span className="text-white text-xs font-medium drop-shadow-sm">
                        {formatCount(video.stats.shares)}
                      </span>
                    </button>

                    {/* Bookmark button with enhanced styling */}
                    <button 
                      onClick={() => handleAction('save', video.id)}
                      className="group flex flex-col items-center gap-1 transition-all duration-200"
                    >
                      <div className="w-10 h-10 rounded-full bg-card/15 backdrop-blur-md border border-white/20 flex items-center justify-center group-active:scale-95 hover:bg-card/25 transition-all duration-200 shadow-lg">
                        <Bookmark className="w-6 h-6 text-white" />
                      </div>
                    </button>

                    {/* Volume/Mute button with enhanced styling */}
                    <button 
                      onClick={handleMute}
                      className={cn(
                        "w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center active:scale-95 transition-all duration-200 shadow-lg",
                        isMuted 
                          ? "bg-card/15 border-white/20 hover:bg-card/25" 
                          : "bg-blue-500/20 border-blue-500/30 shadow-blue-500/25"
                      )}
                    >
                      {isMuted ? (
                        <VolumeX className="w-6 h-6 text-white transition-colors duration-200" />
                      ) : (
                        <Volume2 className="w-6 h-6 text-blue-400 transition-colors duration-200" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>


      {/* Footer navbar for video mode */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <FooterNav
          active={activeTab}
          onSelect={onTabSelect}
          onOpenCreate={onOpenCreate}
          videoMode={true}
        />
      </div>

      {/* Comments Modal */}
      {isCommentsOpen && (
        <div className="fixed inset-0 z-[100]">
          <CommentsModal
            isOpen={isCommentsOpen}
            onClose={() => {
              setIsCommentsOpen(false);
              setPipVideoIndex(null);
            }}
            videoId={relaxVideos[currentIndex]?.id || ''}
            videoTitle={relaxVideos[currentIndex]?.title || relaxVideos[currentIndex]?.description || ''}
            totalComments={relaxVideos[currentIndex]?.stats.comments || 0}
            videoOwnerId={relaxVideos[currentIndex]?.user?.id}
            videoOwnerName={relaxVideos[currentIndex]?.user?.name}
          />
        </div>
      )}

      {/* PIP Video when comments are open */}
      {isCommentsOpen && pipVideoIndex !== null && (() => {
        const pipVideo = relaxVideos.find(v => v.id === pipVideoIndex);
        if (!pipVideo) return null;
        return (
          <DraggablePipVideo
            videoSrc={pipVideo.url}
            isPlaying={true}
            isMuted={isMuted}
            onMuteToggle={handleMute}
            onRestore={() => {
              setIsCommentsOpen(false);
              setPipVideoIndex(null);
            }}
            title={pipVideo.user.name}
          />
        );
      })()}

      <PublicProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedUserId('');
        }}
        userId={selectedUserId}
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
