import { useState, useEffect, useRef, useCallback } from 'react';
import { useHelperRequests } from './useHelperRequests';
import { toast } from 'sonner';

interface Helper {
  user_id: string;
  location_lat: number;
  location_lng: number;
  profiles?: {
    name: string;
    avatar_url?: string;
  };
}

interface UseAutoHelperRequestProps {
  helpers: Helper[];
  alertId: string;
  userLat?: number | null;
  userLng?: number | null;
}

const HELPER_TIMEOUT = 30000; // 30 seconds per helper
const MAX_DURATION = 180000; // 3 minutes total
const HELPER_RETRY_DELAY = 1000; // 1 second between helpers

export const useAutoHelperRequest = ({
  helpers,
  alertId,
  userLat,
  userLng,
}: UseAutoHelperRequestProps) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [currentHelperIndex, setCurrentHelperIndex] = useState(0);
  const [currentHelper, setCurrentHelper] = useState<Helper | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  
  const { sendRequest, sentRequests } = useHelperRequests(alertId);
  
  const helperTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (degrees: number) => degrees * (Math.PI / 180);

  // Sort helpers by distance
  const sortedHelpers = useCallback(() => {
    if (!userLat || !userLng) return helpers;
    
    return [...helpers].sort((a, b) => {
      const distA = calculateDistance(userLat, userLng, a.location_lat, a.location_lng);
      const distB = calculateDistance(userLat, userLng, b.location_lat, b.location_lng);
      return distA - distB;
    });
  }, [helpers, userLat, userLng]);

  // Check if current helper has responded
  useEffect(() => {
    if (!requestId || !isRequesting) return;

    const currentRequest = sentRequests?.find(req => req.id === requestId);
    
    if (currentRequest?.status === 'accepted') {
      // Helper accepted!
      clearAllTimers();
      setIsRequesting(false);
      toast.success(`${currentHelper?.profiles?.name || 'Helper'} is coming to help!`, {
        description: 'They are on their way',
        duration: 5000,
      });
    } else if (currentRequest?.status === 'declined') {
      // Helper declined, move to next immediately
      moveToNextHelper();
    }
  }, [sentRequests, requestId, isRequesting]);

  const clearAllTimers = () => {
    if (helperTimeoutRef.current) {
      clearTimeout(helperTimeoutRef.current);
      helperTimeoutRef.current = null;
    }
    if (totalTimeoutRef.current) {
      clearTimeout(totalTimeoutRef.current);
      totalTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const moveToNextHelper = async () => {
    const sorted = sortedHelpers();
    const nextIndex = currentHelperIndex + 1;

    // Check if we've tried all helpers
    if (nextIndex >= sorted.length) {
      // Start over from the beginning if we have time left
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed < MAX_DURATION) {
        setCurrentHelperIndex(0);
        await requestHelper(sorted[0], 0);
      } else {
        // Time's up
        stopRequesting();
        toast.error('No helpers available', {
          description: 'All nearby helpers are currently busy',
        });
      }
      return;
    }

    setCurrentHelperIndex(nextIndex);
    
    // Small delay before trying next helper
    setTimeout(() => {
      requestHelper(sorted[nextIndex], nextIndex);
    }, HELPER_RETRY_DELAY);
  };

  const requestHelper = async (helper: Helper, index: number) => {
    try {
      setCurrentHelper(helper);
      setTimeRemaining(HELPER_TIMEOUT / 1000);

      const helperName = helper.profiles?.name || 'Helper';
      toast.info(`Requesting ${helperName}...`, {
        description: `Waiting for response (${HELPER_TIMEOUT / 1000}s)`,
      });

      // Send request to this helper
      const result = await sendRequest.mutateAsync({
        alertId,
        helperId: helper.user_id,
        message: 'I need urgent help!',
      });

      setRequestId(result.id);

      // Start countdown
      const countdownStart = Date.now();
      countdownIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - countdownStart;
        const remaining = Math.max(0, Math.ceil((HELPER_TIMEOUT - elapsed) / 1000));
        setTimeRemaining(remaining);
        
        const totalElapsedTime = Date.now() - startTimeRef.current;
        setTotalElapsed(Math.floor(totalElapsedTime / 1000));
      }, 1000);

      // Set timeout for this helper
      helperTimeoutRef.current = setTimeout(() => {
        toast.warning(`${helperName} didn't respond`, {
          description: 'Trying next helper...',
        });
        moveToNextHelper();
      }, HELPER_TIMEOUT);

    } catch (error) {
      console.error('Error requesting helper:', error);
      // Try next helper on error
      moveToNextHelper();
    }
  };

  const startRequesting = () => {
    const sorted = sortedHelpers();
    
    if (sorted.length === 0) {
      toast.error('No helpers available nearby');
      return;
    }

    setIsRequesting(true);
    setCurrentHelperIndex(0);
    startTimeRef.current = Date.now();
    setTotalElapsed(0);

    // Start with first helper
    requestHelper(sorted[0], 0);

    // Set overall timeout (3 minutes)
    totalTimeoutRef.current = setTimeout(() => {
      stopRequesting();
      toast.error('Request timeout', {
        description: 'Unable to find available helper. Please try again.',
      });
    }, MAX_DURATION);
  };

  const stopRequesting = () => {
    setIsRequesting(false);
    setCurrentHelper(null);
    setCurrentHelperIndex(0);
    setTimeRemaining(0);
    setTotalElapsed(0);
    setRequestId(null);
    clearAllTimers();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  return {
    isRequesting,
    currentHelper,
    timeRemaining,
    totalElapsed,
    currentHelperIndex: currentHelperIndex + 1, // 1-indexed for display
    totalHelpers: sortedHelpers().length,
    startRequesting,
    stopRequesting,
  };
};
