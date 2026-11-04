import React, { useState, useRef, useCallback } from 'react';
import { UnifiedVideoPlayer } from './UnifiedVideoPlayer';
import { VideoFullscreenModal } from './VideoFullscreenModal';
import { useVideoFeed, Video } from '@/hooks/useVideoFeed';
import { useNavigation } from '@/contexts/NavigationContext';

interface UnifiedRelaxViewProps {
  autoOpenFirstVideo?: boolean;
  onBackToFeed?: () => void;
  activeTab?: "home" | "circles" | "add" | "ask" | "safe";
  onTabSelect?: (key: "home" | "circles" | "add" | "ask" | "safe") => void;
  onOpenCreate?: () => void;
  onRefresh?: () => void;
}

import { SerkleLoader } from './ui/SerkleLoader';

export const UnifiedRelaxView: React.FC<UnifiedRelaxViewProps> = ({ 
  autoOpenFirstVideo = false, 
  onBackToFeed,
  activeTab = "home",
  onTabSelect = () => {},
  onOpenCreate = () => {},
  onRefresh = () => {}
}) => {
  const { videos, loading, refetch } = useVideoFeed();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullscreenVideo, setFullscreenVideo] = useState<Video | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const { pushModalState } = useNavigation();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);

  // Fixed height calculation
  const videoHeight = window.innerHeight - 50;

  // Handle touch gestures with debouncing
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isTransitioning || isRefreshing) return;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, [isTransitioning, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isTransitioning || isRefreshing) return;
    touchCurrentY.current = e.touches[0].clientY;
    
    // Calculate pull progress for refresh indicator
    if (currentIndex === 0 && touchCurrentY.current > touchStartY.current) {
      const deltaY = touchCurrentY.current - touchStartY.current;
      if (deltaY > 0 && deltaY < 150) {
        setPullProgress(deltaY);
        // Prevent default only when actively pulling down at the top
        if (e.cancelable) e.preventDefault();
      }
    }
  }, [currentIndex, isTransitioning, isRefreshing]);

  const handleTouchEnd = useCallback(async (e: React.TouchEvent) => {
    if (isTransitioning || isRefreshing) return;

    setPullProgress(0);
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    const deltaY = touchEndY - touchStartY.current;
    const deltaTime = touchEndTime - touchStartTime.current;
    const velocity = Math.abs(deltaY) / deltaTime;

    // Pull-to-refresh
    if (currentIndex === 0 && deltaY > 120 && velocity > 0.5) {
      setIsRefreshing(true);
      await refetch();
      if (onRefresh) onRefresh();
      setIsRefreshing(false);
      return;
    }

    // Navigation with smooth transitions
    if (Math.abs(deltaY) > 80 && velocity > 0.4) {
      setIsTransitioning(true);
      
      if (deltaY < 0 && currentIndex < videos.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (deltaY > 0 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
      
      // Reset transition lock
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, videos.length, onRefresh, isTransitioning]);

  const handleVideoClick = useCallback((video: Video) => {
    pushModalState('video-fullscreen', () => setFullscreenVideo(null));
    setFullscreenVideo(video);
  }, [pushModalState]);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVideo(null);
    if (onBackToFeed && autoOpenFirstVideo) {
      onBackToFeed();
    }
  }, [onBackToFeed, autoOpenFirstVideo]);

  // Auto-open first video in fullscreen - only when component first mounts
  React.useEffect(() => {
    if (autoOpenFirstVideo && videos.length > 0 && !fullscreenVideo && currentIndex === 0) {
      pushModalState('video-fullscreen-auto', () => setFullscreenVideo(null));
      setFullscreenVideo(videos[0]);
    }
  }, [autoOpenFirstVideo, videos.length, pushModalState]);

  // Render only current video and adjacent ones to prevent duplicates
  const visibleIndices = [];
  for (let i = Math.max(0, currentIndex - 1); i <= Math.min(videos.length - 1, currentIndex + 1); i++) {
    visibleIndices.push(i);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4">
        <SerkleLoader size="lg" pulse={true} />
        <div className="text-muted-foreground font-medium text-sm">Loading videos...</div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white">No videos available</div>
      </div>
    );
  }

  return (
    <>
      <div 
        ref={containerRef}
        className="fixed inset-0 bg-black overflow-hidden"
        style={{ 
          top: '50px',
          height: `${videoHeight}px`,
          touchAction: 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Pull to refresh indicator */}
        {(pullProgress > 0 || isRefreshing) && currentIndex === 0 && (
          <div 
            className="absolute left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-200"
            style={{ 
              top: `${Math.min(pullProgress * 0.5, 60)}px`,
              opacity: Math.min(pullProgress / 100, 1)
            }}
          >
            <div className="bg-background/80 backdrop-blur-sm p-2 rounded-full shadow-lg border border-white/10">
              <SerkleLoader size="sm" pulse={isRefreshing} label={isRefreshing ? 'Refreshing videos' : 'Pull to refresh'} />
            </div>
          </div>
        )}

        {visibleIndices.map((index) => {
          const video = videos[index];
          const translateY = (index - currentIndex) * videoHeight;
          
          return (
            <div
              key={`unified-video-${index}-${currentIndex}`}
              className="absolute inset-0 w-full"
              style={{
                height: `${videoHeight}px`,
                transform: `translateY(${translateY}px)`,
                transition: isTransitioning ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
                willChange: 'transform',
                zIndex: index === currentIndex ? 20 : 10
              }}
            >
              <UnifiedVideoPlayer
                video={video}
                isActive={index === currentIndex}
                index={index}
                onVideoClick={() => handleVideoClick(video)}
              />
            </div>
          );
        })}
      </div>

      {fullscreenVideo && (
        <VideoFullscreenModal
          video={fullscreenVideo}
          videos={videos}
          isOpen={!!fullscreenVideo}
          onClose={handleCloseFullscreen}
          activeTab={activeTab}
          onTabSelect={onTabSelect}
          onOpenCreate={onOpenCreate}
        />
      )}
    </>
  );
};
