import { useCallback, useRef } from 'react';

interface VideoPrebufferingOptions {
  currentIndex: number;
  videos: any[];
}

export const useVideoPrebuffering = ({ currentIndex, videos }: VideoPrebufferingOptions) => {
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const registerVideo = useCallback((index: number, element: HTMLVideoElement | null) => {
    if (element) {
      videoRefs.current.set(index, element);
    } else {
      videoRefs.current.delete(index);
    }
  }, []);

  const getPreloadStrategy = useCallback((index: number): 'auto' | 'metadata' | 'none' => {
    const distance = Math.abs(index - currentIndex);
    
    if (distance === 0) {
      // Current video: full preloading
      return 'auto';
    } else if (distance <= 2) {
      // Adjacent videos (including previous): aggressive preloading for smooth swiping
      return 'auto';
    } else if (distance === 3) {
      // Buffer zone: metadata only
      return 'metadata';
    } else {
      // Far away: no preloading
      return 'none';
    }
  }, [currentIndex]);

  const shouldDetachSrc = useCallback((index: number): boolean => {
    const distance = Math.abs(index - currentIndex);
    return distance > 4; // Further increased buffer to prevent black screens
  }, [currentIndex]);

  const updateVideoPrebuffering = useCallback(() => {
    videoRefs.current.forEach((video, index) => {
      const preloadStrategy = getPreloadStrategy(index);
      const shouldDetach = shouldDetachSrc(index);
      
      if (shouldDetach) {
        // Detach src to free memory and clean up
        if (video.src) {
          video.pause();
          video.removeAttribute('src');
          video.load();
          // Clear any cached data
          video.currentTime = 0;
        }
      } else {
        // Ensure src is attached and set preload strategy
        const expectedSrc = videos[index]?.url;
        if (expectedSrc && video.src !== expectedSrc) {
          video.src = expectedSrc;
          video.preload = preloadStrategy;
        } else if (video.preload !== preloadStrategy) {
          video.preload = preloadStrategy;
        }
      }
    });
  }, [currentIndex, videos, getPreloadStrategy, shouldDetachSrc]);

  return {
    registerVideo,
    getPreloadStrategy,
    shouldDetachSrc,
    updateVideoPrebuffering
  };
};