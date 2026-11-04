import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
}

interface UseGeolocationReturn extends GeolocationState {
  refreshLocation: () => void;
  startWatching: () => void;
  stopWatching: () => void;
}

export const useGeolocation = (): UseGeolocationReturn => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  const handleSuccess = (position: GeolocationPosition) => {
    setState({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      loading: false,
      error: null,
    });
  };

  const handleError = (error: GeolocationPositionError) => {
    let errorMessage = 'Failed to get location';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timeout';
        break;
    }

    setState(prev => ({
      ...prev,
      loading: false,
      error: errorMessage,
    }));
    
    toast.error(errorMessage);
  };

  const refreshLocation = () => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation not supported',
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));
    
    // Try with high accuracy first, then fallback to low accuracy
    navigator.geolocation.getCurrentPosition(
      handleSuccess, 
      (error) => {
        // If high accuracy fails, try with low accuracy
        if (error.code === error.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            handleError,
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 60000,
            }
          );
        } else {
          handleError(error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const startWatching = () => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation not supported',
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    const id = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );

    setWatchId(id);
  };

  const stopWatching = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  };

  useEffect(() => {
    refreshLocation();
    return () => {
      stopWatching();
    };
  }, []);

  return {
    ...state,
    refreshLocation,
    startWatching,
    stopWatching,
  };
};
