import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

// Helper to get or create session ID
export const getSessionId = (): string => {
  let sessionId = localStorage.getItem('guest_session_id');
  if (!sessionId) {
    // Generate a simple unique ID if crypto API is not supported
    sessionId = typeof crypto.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('guest_session_id', sessionId);
  }
  return sessionId;
};

export const useVideoViewTracker = (
  videoElement: HTMLVideoElement | null,
  videoId: string | undefined
) => {
  const { user } = useUser();
  const hasTrackedView = useRef(false);

  useEffect(() => {
    // Reset tracking flag when video changes
    hasTrackedView.current = false;
  }, [videoId]);

  useEffect(() => {
    if (!videoElement || !videoId) return;

    const sessionId = getSessionId();

    const handleTimeUpdate = async () => {
      if (hasTrackedView.current) return;

      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;

      if (!duration || isNaN(duration) || duration <= 0) return;

      // Track view when video has played for >= 3 seconds OR >= 30% of its duration
      if (currentTime >= 3 || (currentTime / duration) >= 0.3) {
        hasTrackedView.current = true;
        
        try {
          // Fire and forget RPC
          // @ts-ignore - 'track_video_view' missing from generated types
          supabase.rpc('track_video_view', {
            p_video_id: videoId,
            p_user_id: user?.id || null,
            p_session_id: sessionId
          }).then(({ error }) => {
            if (error) console.error("Error from track_video_view", error.message);
          });
        } catch (error) {
          console.error("Failed to call track_video_view", error);
        }
      }
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoElement, videoId, user?.id]);
};
