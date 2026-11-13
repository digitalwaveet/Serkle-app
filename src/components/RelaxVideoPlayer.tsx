import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Heart, MessageCircle, Share, Bookmark, Volume2, VolumeX, Plus, Check, ChevronDown, RefreshCw, Gauge, Play } from 'lucide-react';
import type Hls from 'hls.js';
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
import { isHlsSource, loadHlsJs, supportsNativeHls } from '@/utils/videoUtils';
import './relax-video-player.css';

type NetworkInformationLike = EventTarget & {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
};

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
  const { videos: relaxVideosRaw, loading: videosLoading, error: videosError, hasMore, loadMore, refetch } = useVideoFeed();
  const relaxVideos = useMemo(() => relaxVideosRaw ?? [], [relaxVideosRaw]);
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
  const [containedVideos, setContainedVideos] = useState<Set<string>>(new Set());
  const [pausedVideos, setPausedVideos] = useState<Set<string>>(new Set());
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set());
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [pipVideoIndex, setPipVideoIndex] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [shareVideoId, setShareVideoId] = useState<string | null>(null);
  const [shareVideoUrl, setShareVideoUrl] = useState<string>('');
  const [videoHeight, setVideoHeight] = useState(() => Math.max(1, window.innerHeight - 50));
  const [isConstrainedConnection, setIsConstrainedConnection] = useState(false);
  const [showQualityLabel, setShowQualityLabel] = useState(false);
  const [doubleTapHearts, setDoubleTapHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const hlsRefs = useRef<Map<string, Hls>>(new Map());
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const qualityLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    let frame = 0;
    const syncViewport = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = window.visualViewport?.height || window.innerHeight;
        root.style.setProperty('--relax-viewport-height', `${Math.round(height)}px`);
      });
    };
    syncViewport();
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);

    return () => {
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousOverscroll;
    };
  }, []);

  useEffect(() => {
    const connection = (navigator as NavigatorWithConnection).connection;
    if (!connection) return;
    const syncConnectionMode = () => {
      setIsConstrainedConnection(Boolean(
        connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
      ));
    };
    syncConnectionMode();
    connection.addEventListener('change', syncConnectionMode);
    return () => connection.removeEventListener('change', syncConnectionMode);
  }, []);

  useEffect(() => () => {
    hlsRefs.current.forEach(instance => instance.destroy());
    hlsRefs.current.clear();
    if (qualityLabelTimerRef.current) clearTimeout(qualityLabelTimerRef.current);
  }, []);

  const revealQualityLabel = useCallback(() => {
    setShowQualityLabel(true);
    if (qualityLabelTimerRef.current) clearTimeout(qualityLabelTimerRef.current);
    qualityLabelTimerRef.current = setTimeout(() => setShowQualityLabel(false), 1800);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateHeight = () => setVideoHeight(Math.max(1, container.clientHeight));
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);
    window.addEventListener('orientationchange', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', updateHeight);
    };
  }, []);

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
  }, [initialVideoId, initialOpenComments, relaxVideos, videoHeight]);

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
      if (video && element.dataset.videoSource !== video.url) {
        element.dataset.videoSource = video.url;
        element.muted = isMuted;
        element.preload = videoIndex === currentIndex && !isConstrainedConnection ? 'auto' : 'metadata';

        hlsRefs.current.get(videoId)?.destroy();
        hlsRefs.current.delete(videoId);
        if (isHlsSource(video.url) && !supportsNativeHls()) {
          void loadHlsJs().then(HlsClass => {
            if (!HlsClass || videoRefs.current.get(videoId) !== element) return;
            const hls = new HlsClass({
              startLevel: -1,
              capLevelToPlayerSize: true,
              maxBufferLength: isConstrainedConnection ? 12 : 30,
              backBufferLength: 15,
            });
            hls.attachMedia(element);
            hls.on(HlsClass.Events.MEDIA_ATTACHED, () => hls.loadSource(video.url));
            hlsRefs.current.set(videoId, hls);
          });
        } else {
          element.src = video.url;
        }
        
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
        
        element.addEventListener('loadstart', handleLoadStart);
        element.addEventListener('canplay', handleCanPlay);
        element.addEventListener('waiting', handleWaiting);
        element.addEventListener('playing', handlePlaying);
        element.addEventListener('pause', handlePause);
        element.addEventListener('ended', handleEnded);
        
        // Store cleanup function
        element.dataset.cleanup = 'true';
      }
    } else {
      videoRefs.current.delete(videoId);
      queueMicrotask(() => {
        if (videoRefs.current.has(videoId)) return;
        hlsRefs.current.get(videoId)?.destroy();
        hlsRefs.current.delete(videoId);
      });
    }
  }, [relaxVideos, currentIndex, isMuted, isConstrainedConnection]);

  // Handle video playback state changes
  useEffect(() => {
    const currentVideo = relaxVideos[currentIndex];
    if (!currentVideo) return;

    videoRefs.current.forEach((video, videoId) => {
      if (videoId === currentVideo.id) {
        // Play current video
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
  }, [currentIndex, relaxVideos?.length, onRefresh, isTransitioning, hasMore, loadMore]);

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

  const handleVideoMetadata = useCallback((videoId: string, element: HTMLVideoElement) => {
    if (!element.videoWidth || !element.videoHeight) return;
    const ratio = element.videoWidth / element.videoHeight;
    const shouldContain = ratio > 2.05 || ratio < 0.44;
    setContainedVideos(previous => {
      const currentlyContained = previous.has(videoId);
      if (currentlyContained === shouldContain) return previous;
      const next = new Set(previous);
      if (shouldContain) next.add(videoId);
      else next.delete(videoId);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleMediaKeys = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === ' ') {
        event.preventDefault();
        const currentVideo = relaxVideos[currentIndex];
        if (currentVideo) togglePlayPause(currentVideo.id);
      } else if (event.key.toLowerCase() === 'm') {
        handleMute();
      }
    };
    window.addEventListener('keydown', handleMediaKeys);
    return () => window.removeEventListener('keydown', handleMediaKeys);
  }, [currentIndex, handleMute, relaxVideos, togglePlayPause]);

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
      const touch = e.changedTouches?.[0] || e.touches?.[0];
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
  }, [handleDoubleTap, togglePlayPause]);

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
    <div ref={rootRef} className="relax-feed">
      {/* Video container */}
      <div 
        ref={containerRef}
        className={`relax-viewport transition-all duration-300 ${
          isCommentsOpen ? 'blur-[8px] brightness-[0.3]' : ''
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <header className="relax-header bg-gradient-to-b from-black/60 via-black/20 to-transparent text-white">
          {onBackToFeed ? (
            <button type="button" onClick={onBackToFeed} className="pointer-events-auto grid size-11 place-items-center rounded-full text-white drop-shadow-lg transition-transform duration-200 hover:scale-110 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Back to feed">
              <ChevronDown className="size-5" />
            </button>
          ) : <span className="size-11" />}
          <div className="relax-header__title drop-shadow-md"><p className="text-base font-extrabold tracking-tight">Relax</p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">For you</p></div>
          <div className="pointer-events-auto relative flex size-11 items-center justify-center">
            <button
              type="button"
              onClick={revealQualityLabel}
              className="group grid size-10 place-items-center rounded-full text-white transition-transform duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={`Quality mode: ${isConstrainedConnection ? 'Auto data saver' : 'Auto'}`}
              aria-describedby={showQualityLabel ? 'relax-quality-label' : undefined}
            >
              <Gauge className="size-4 drop-shadow-md transition-transform duration-200 group-hover:scale-110" />
            </button>
            <span
              id="relax-quality-label"
              role="status"
              className={cn(
                "pointer-events-none absolute right-0 top-full mt-0.5 whitespace-nowrap text-[9px] font-semibold tracking-wide text-white drop-shadow-lg transition-all duration-200",
                showQualityLabel ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
              )}
            >
              Auto quality
            </span>
          </div>
        </header>

        {videosLoading && relaxVideos.length === 0 && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black text-white" role="status">
            <div className="mb-5 aspect-[3/4] w-[72%] max-w-xs animate-pulse rounded-[2rem] bg-white/[0.08]" />
            <SerkleLoader dark label="Preparing Relax" />
          </div>
        )}

        {!videosLoading && videosError && relaxVideos.length === 0 && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-8 text-center text-white">
            <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/10"><RefreshCw className="size-6" /></div>
            <h2 className="text-xl font-bold">Relax couldn’t load</h2>
            <p className="mt-2 max-w-xs text-sm leading-6 text-white/[0.65]">Check your connection and try again.</p>
            <button type="button" onClick={refetch} className="mt-5 min-h-12 rounded-full bg-white px-6 font-bold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary">Try again</button>
          </div>
        )}

        {!videosLoading && !videosError && relaxVideos.length === 0 && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-8 text-center text-white"><h2 className="text-xl font-bold">Nothing to watch yet</h2><p className="mt-2 text-sm text-white/[0.65]">New videos will appear here.</p></div>
        )}

        {visibleVideoIndices.map((index) => {
          const video = relaxVideos[index];
          if (!video) return null;
          const translateY = (index - currentIndex) * videoHeight;
          const isActive = index === currentIndex;
          const isLiked = video.liked || likedVideos.has(video.id);
          const videoIsLoading = isLoading[video.id] || false;
          const isCaptionExpanded = expandedCaptions.has(video.id);
          
          return (
            <div
              key={`relax-video-${index}-${video.id}`}
              className="relax-slide"
              style={{
                transform: `translateY(${translateY}px)`,
                transition: isTransitioning ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
                willChange: 'transform',
                zIndex: isActive ? 20 : 10
              }}
            >
              <div className="relax-stage">
              <div className="relax-media-layer overflow-hidden bg-black">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt=""
                    aria-hidden="true"
                    className="absolute -inset-8 h-[calc(100%+4rem)] w-[calc(100%+4rem)] scale-110 object-cover opacity-45 blur-3xl"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-black to-primary/50" />
                )}
                <div className="absolute inset-0 bg-black/25" />
              </div>

              {/* Video element */}
              <video
                ref={(el) => registerVideo(video.id, el)}
                className={cn("relax-media", containedVideos.has(video.id) && "relax-media--contain")}
                poster={video.thumbnail}
                loop
                playsInline
                muted={isMuted}
                onLoadedMetadata={(event) => handleVideoMetadata(video.id, event.currentTarget)}
              />

              <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/10 via-transparent via-55% to-black/75" />

              {/* Tap zone for play/pause and like */}
              <div
                className="absolute inset-0 z-10"
                onClick={(e) => handleTap(e, video.id)}
              />

              {/* Play icon overlay */}
              {isActive && pausedVideos.has(video.id) && !videoIsLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-all duration-300">
                  <Play className="size-14 fill-white text-white opacity-95 drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)] animate-in zoom-in-75 duration-200" aria-hidden="true" />
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
                    const isExpanded = isCaptionExpanded;
                    const showReadMore = needsReadMore(video.description);
                    
                    return (
                      <div 
                        className={cn(
                          "relax-meta isolate rounded-[1.05rem] border border-white/[0.02] bg-gradient-to-br from-white/[0.008] via-transparent to-black/[0.006] p-2 text-white shadow-[0_12px_42px_rgba(0,0,0,0.025)] backdrop-saturate-125",
                          isExpanded
                            ? "relax-meta--expanded"
                            : "backdrop-blur-sm before:pointer-events-none before:absolute before:-inset-2 before:-z-10 before:rounded-[1.4rem] before:bg-black/[0.008] before:blur-lg"
                        )}
                      >
                        {/* User info - pushes up when caption expands */}
                        <div className="mb-1 flex items-center gap-1.5">
                          <div className="relative">
                            <div 
                              className="flex size-7 items-center justify-center overflow-hidden rounded-full border border-white/80 text-[9px] font-semibold"
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
                                className="absolute -bottom-1 -right-1 z-10 flex size-4 items-center justify-center rounded-full border border-white bg-card shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
                                aria-label={`Follow ${video.user.name}`}
                              >
                                {(followStates[video.user.id] || 'visible') === 'visible' ? (
                                  <Plus className="size-2 text-primary" />
                                ) : (
                                  <Check className="size-2 text-green-500" />
                                )}
                              </button>
                            )}
                          </div>
                          <div>
                            <p 
                              className="relax-meta__name relative z-10 cursor-pointer font-bold hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUserId(video.user.id);
                                setShowProfileModal(true);
                              }}
                            >
                              {video.user.name}
                            </p>
                            <p className="relax-meta__username text-white/[0.72]">@{video.user.username}</p>
                          </div>
                        </div>
                        
                        {/* Title */}
                        {video.title && (
                          <h3 className="relax-meta__title mb-0.5 line-clamp-1 font-bold drop-shadow-sm">{video.title}</h3>
                        )}

                        {/* Caption with expandable functionality */}
                        <div className="mb-1">
                          {!isExpanded ? (
                            /* Collapsed state - 2 lines with Read More button */
                            <div>
                              <p className="relax-meta__description mb-0.5">
                                {video.description}
                              </p>
                              {showReadMore && (
                                <button
                                  onClick={() => toggleCaptionExpansion(video.id)}
                                  className="min-h-8 rounded-md pr-2 text-xs font-bold text-secondary transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                >
                                  More
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Expanded state - full text */
                            <div>
                              <p className="relax-meta__description">
                                {video.description}
                              </p>
                              <button
                                type="button"
                                onClick={() => toggleCaptionExpansion(video.id)}
                                className="mt-2 min-h-10 rounded-full border border-white/20 px-4 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                              >
                                Less
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Tags - always visible */}
                        {video.tags && video.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {video.tags.slice(0, isExpanded ? video.tags.length : 3).map((tag, tagIndex) => (
                              <span 
                                key={tagIndex} 
                                className="relax-meta__tag rounded-full border border-white/20 bg-card/10 px-2 py-1 text-white shadow-sm backdrop-blur-md"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Compact glass action rail */}
                  <div className={cn("relax-actions", isCaptionExpanded && "relax-actions--hidden")}>
                    <button 
                      onClick={() => handleLike(video.id)}
                      className="relax-action group flex flex-col gap-0.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                      aria-label={`${isLiked ? 'Unlike' : 'Like'} video, ${formatCount(video.stats.likes)} likes`}
                    >
                      <Heart className={cn("size-5 text-white transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:scale-75", isLiked && "scale-110 fill-rose-500 text-rose-500")} />
                      <span className="relax-action__count font-semibold text-white/90 tabular-nums">
                        {formatCount(video.stats.likes + (isLiked ? 1 : 0))}
                      </span>
                    </button>

                    <button 
                      onClick={() => {
                        setIsCommentsOpen(true);
                        setPipVideoIndex(video.id);
                        triggerHaptic('light');
                      }}
                      className="relax-action group flex flex-col gap-0.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                      aria-label={`Open comments, ${formatCount(video.stats.comments)} comments`}
                    >
                      <MessageCircle className="size-5 text-white transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:scale-75" />
                      <span className="relax-action__count font-semibold text-white/90 tabular-nums">
                        {formatCount(video.stats.comments)}
                      </span>
                    </button>

                    <button 
                      onClick={() => {
                        setShareVideoId(video.id);
                        setShareVideoUrl(video.url);
                      }}
                      className="relax-action group flex flex-col gap-0.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                      aria-label={`Share video, ${formatCount(video.stats.shares)} shares`}
                    >
                      <Share className="size-5 text-white transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:-rotate-6 motion-safe:group-active:scale-75" />
                      <span className="relax-action__count font-semibold text-white/90 tabular-nums">
                        {formatCount(video.stats.shares)}
                      </span>
                    </button>

                    <button 
                      onClick={() => handleAction('save', video.id)}
                      className="relax-action group grid place-items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                      aria-label={video.saved ? "Remove video from saved" : "Save video"}
                    >
                      <Bookmark className={cn("size-5 text-white transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:scale-75", video.saved && "fill-secondary text-secondary")} />
                    </button>

                    <button 
                      onClick={handleMute}
                      className="relax-action group grid place-items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                      aria-label={isMuted ? "Unmute video" : "Mute video"}
                    >
                      {isMuted ? (
                        <VolumeX className="size-5 text-white transition-transform duration-200 motion-safe:group-active:scale-75" />
                      ) : (
                        <Volume2 className="size-5 text-secondary transition-transform duration-200 motion-safe:group-active:scale-75" />
                      )}
                    </button>
                  </div>
                </>
              )}
              </div>
            </div>
          );
        })}
      </div>


      {/* Footer navbar for video mode */}
      <div className="relax-nav-layer">
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
