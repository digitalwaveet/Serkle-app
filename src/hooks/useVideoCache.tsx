import { useCallback, useRef, useEffect } from 'react';
import { Video } from '@/data/mock';

interface VideoCacheOptions {
  currentIndex: number;
  videos: Video[];
  cacheRadius?: number; // How many videos to cache around current
}

export const useVideoCache = ({ currentIndex, videos, cacheRadius = 2 }: VideoCacheOptions) => {
  const cacheRef = useRef<Cache | null>(null);
  const pendingCacheOperations = useRef<Set<string>>(new Set());

  // Initialize cache
  useEffect(() => {
    const initCache = async () => {
      if ('caches' in window) {
        try {
          cacheRef.current = await caches.open('video-cache-v1');
        } catch (error) {
          console.warn('Failed to initialize video cache:', error);
        }
      }
    };
    initCache();
  }, []);

  const cacheVideo = useCallback(async (video: Video): Promise<void> => {
    if (!cacheRef.current || !video.url || pendingCacheOperations.current.has(video.url)) {
      return;
    }

    pendingCacheOperations.current.add(video.url);

    try {
      // Check if already cached
      const cachedResponse = await cacheRef.current.match(video.url);
      if (cachedResponse) {
        pendingCacheOperations.current.delete(video.url);
        return;
      }

      // Use requestIdleCallback for background caching
      const cacheOperation = () => {
        fetch(video.url, { 
          method: 'GET',
          headers: {
            'Range': 'bytes=0-1048576' // Cache first 1MB for quick start
          }
        })
        .then(response => {
          if (response.ok && cacheRef.current) {
            return cacheRef.current.put(video.url, response.clone());
          }
        })
        .catch(error => {
          console.warn(`Failed to cache video ${video.id}:`, error);
        })
        .finally(() => {
          pendingCacheOperations.current.delete(video.url);
        });
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(cacheOperation, { timeout: 5000 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(cacheOperation, 100);
      }
    } catch (error) {
      console.warn(`Error initiating cache for video ${video.id}:`, error);
      pendingCacheOperations.current.delete(video.url);
    }
  }, []);

  const getCachedVideoUrl = useCallback(async (video: Video): Promise<string> => {
    if (!cacheRef.current) return video.url;

    try {
      const cachedResponse = await cacheRef.current.match(video.url);
      if (cachedResponse) {
        return URL.createObjectURL(await cachedResponse.blob());
      }
    } catch (error) {
      console.warn(`Failed to get cached video ${video.id}:`, error);
    }
    
    return video.url;
  }, []);

  const clearOldCache = useCallback(async () => {
    if (!cacheRef.current) return;

    try {
      const keys = await cacheRef.current.keys();
      const currentVideoUrls = new Set(
        videos.slice(
          Math.max(0, currentIndex - cacheRadius),
          Math.min(videos.length, currentIndex + cacheRadius + 1)
        ).map(v => v.url)
      );

      // Remove videos that are far from current index
      const deletePromises = keys
        .filter(request => !currentVideoUrls.has(request.url))
        .map(request => cacheRef.current!.delete(request));

      await Promise.all(deletePromises);
    } catch (error) {
      console.warn('Failed to clear old cache:', error);
    }
  }, [currentIndex, videos, cacheRadius]);

  // Auto-cache videos around current index
  useEffect(() => {
    const cacheAroundCurrent = () => {
      const startIndex = Math.max(0, currentIndex - cacheRadius);
      const endIndex = Math.min(videos.length - 1, currentIndex + cacheRadius);

      for (let i = startIndex; i <= endIndex; i++) {
        if (videos[i]) {
          cacheVideo(videos[i]);
        }
      }
    };

    // Use requestIdleCallback for background caching
    if ('requestIdleCallback' in window) {
      requestIdleCallback(cacheAroundCurrent);
    } else {
      setTimeout(cacheAroundCurrent, 0);
    }

    // Clean up old cache entries
    clearOldCache();
  }, [currentIndex, cacheVideo, clearOldCache]);

  return {
    cacheVideo,
    getCachedVideoUrl,
    clearOldCache
  };
};