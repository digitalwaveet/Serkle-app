// Development logging utilities for video performance
const isDev = import.meta.env.DEV;

export const videoLogger = {
  timeToFirstFrame: (videoId: string | number, startTime: number) => {
    if (isDev) {
      const duration = performance.now() - startTime;
      console.log(`[Video ${videoId}] Time to first frame: ${duration.toFixed(2)}ms`);
    }
  },

  bufferingStart: (videoId: string | number) => {
    if (isDev) {
      console.log(`[Video ${videoId}] Buffering started`);
    }
  },

  bufferingEnd: (videoId: string | number, duration: number) => {
    if (isDev) {
      console.log(`[Video ${videoId}] Buffering ended after ${duration.toFixed(2)}ms`);
    }
  },

  preloadStrategy: (videoId: string | number, strategy: string) => {
    if (isDev) {
      console.log(`[Video ${videoId}] Preload strategy: ${strategy}`);
    }
  }
};

// HLS.js lazy loading utility
export const loadHlsJs = async () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const { default: Hls } = await import('hls.js');
    return Hls;
  } catch (error) {
    console.warn('HLS.js could not be loaded:', error);
    return null;
  }
};

// Check if video source is HLS
export const isHlsSource = (src: string): boolean => {
  return src.includes('.m3u8');
};

// Check if browser supports native HLS
export const supportsNativeHls = (): boolean => {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
};