import { useState, useMemo, useCallback } from 'react';
import { Video } from '@/hooks/useVideoFeed';

interface UseVideoVirtualizationOptions {
  videos: Video[];
  initialIndex?: number;
}

interface VideoVirtualizationReturn {
  currentIndex: number;
  visibleVideos: Array<{
    video: Video;
    index: number;
    isCurrent: boolean;
    isAdjacent: boolean;
  }>;
  setCurrentIndex: (index: number) => void;
  goToNext: () => void;
  goToPrevious: () => void;
}

export const useVideoVirtualization = ({
  videos,
  initialIndex = 0
}: UseVideoVirtualizationOptions): VideoVirtualizationReturn => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const visibleVideos = useMemo(() => {
    const result = [];
    
    // Ensure we always have a buffer of videos around current index
    const startIndex = Math.max(0, currentIndex - 2);
    const endIndex = Math.min(videos.length - 1, currentIndex + 2);
    
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({
        video: videos[i],
        index: i,
        isCurrent: i === currentIndex,
        isAdjacent: Math.abs(i - currentIndex) === 1
      });
    }
    
    return result;
  }, [videos, currentIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(videos.length - 1, prev + 1));
  }, [videos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  return {
    currentIndex,
    visibleVideos,
    setCurrentIndex,
    goToNext,
    goToPrevious
  };
};