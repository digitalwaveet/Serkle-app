import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, MapPin, Star, Clock, Navigation, X } from 'lucide-react';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useAutoHelperRequest } from '@/hooks/useAutoHelperRequest';
import { useHelperRequests } from '@/hooks/useHelperRequests';
import { AutoRequestProgress } from './AutoRequestProgress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HelperTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertId: string;
  alertLat: number;
  alertLng: number;
  helpers: any[];
}

export const HelperTrackingModal: React.FC<HelperTrackingModalProps> = ({
  isOpen,
  onClose,
  alertId,
  alertLat,
  alertLng,
  helpers,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const requesterMarker = useRef<mapboxgl.Marker | null>(null);
  const helperMarker = useRef<mapboxgl.Marker | null>(null);
  
  const { data: mapboxToken, isLoading: isTokenLoading } = useMapboxToken();
  const { sentRequests } = useHelperRequests(alertId);
  const autoRequest = useAutoHelperRequest({
    helpers,
    alertId,
    userLat: alertLat,
    userLng: alertLng,
  });

  const [acceptedHelper, setAcceptedHelper] = useState<any>(null);
  const [helperLocation, setHelperLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Check for accepted helper
  useEffect(() => {
    const accepted = sentRequests?.find(req => req.status === 'accepted');
    if (accepted) {
      setAcceptedHelper(accepted);
      autoRequest.stopRequesting();
    }
  }, [sentRequests]);

  // Fetch helper's real-time location
  const { data: helperProfile } = useQuery({
    queryKey: ['helper-location', acceptedHelper?.helper_id],
    queryFn: async () => {
      if (!acceptedHelper) return null;

      const { data, error } = await supabase
        .from('helper_profiles')
        .select('user_id, location_lat, location_lng')
        .eq('user_id', acceptedHelper.helper_id)
        .single();

      if (error) throw error;

      // Fetch profile info
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, avatar_url, initials, avatar_color')
        .eq('id', data.user_id)
        .single();

      return { ...data, profiles: profile };
    },
    enabled: !!acceptedHelper,
    refetchInterval: 3000, // Update every 3 seconds
  });

  // Update helper location when data changes
  useEffect(() => {
    if (helperProfile?.location_lat && helperProfile?.location_lng) {
      setHelperLocation({
        lat: helperProfile.location_lat,
        lng: helperProfile.location_lng,
      });
    }
  }, [helperProfile]);

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainer.current || !mapboxToken || map.current) return;

    setIsMapLoaded(false);
    mapboxgl.accessToken = mapboxToken;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [alertLng, alertLat],
        zoom: 13,
        // Performance optimizations
        antialias: false,
        preserveDrawingBuffer: false,
        refreshExpiredTiles: false,
      });

      // Navigation control
      map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      // Mark as loaded when map is ready
      map.current.on('load', () => {
        setIsMapLoaded(true);
      });

      // Error handling
      map.current.on('error', (e) => {
        console.error('Map error:', e);
        toast.error('Map failed to load. Please try again.');
        setIsMapLoaded(true);
      });

    } catch (error) {
      console.error('Failed to initialize map:', error);
      toast.error('Unable to load map');
      setIsMapLoaded(true);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setIsMapLoaded(false);
    };
  }, [isOpen, mapboxToken, alertLat, alertLng]);

  // Add/Update requester marker
  useEffect(() => {
    if (!map.current || !alertLat || !alertLng) return;

    if (requesterMarker.current) {
      requesterMarker.current.setLngLat([alertLng, alertLat]);
    } else {
      const el = document.createElement('div');
      el.className = 'requester-marker';
      el.innerHTML = `
        <div class="relative">
          <div class="w-12 h-12 bg-red-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-30"></div>
        </div>
      `;

      requesterMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([alertLng, alertLat])
        .addTo(map.current);
    }
  }, [alertLat, alertLng]);

  // Add/Update helper marker
  useEffect(() => {
    if (!map.current || !helperLocation) return;

    if (helperMarker.current) {
      helperMarker.current.setLngLat([helperLocation.lng, helperLocation.lat]);
    } else {
      const el = document.createElement('div');
      el.className = 'helper-marker';
      const profile = helperProfile?.profiles;
      el.innerHTML = `
        <div class="relative">
          <div class="w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold" style="background-color: ${profile?.avatar_color || '#10b981'}">
            ${profile?.initials || 'H'}
          </div>
          <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
        </div>
      `;

      helperMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([helperLocation.lng, helperLocation.lat])
        .addTo(map.current);
    }

    // Fit bounds to show both markers
    if (requesterMarker.current && helperMarker.current) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([alertLng, alertLat]);
      bounds.extend([helperLocation.lng, helperLocation.lat]);
      map.current?.fitBounds(bounds, { padding: 100 });
    }
  }, [helperLocation, helperProfile]);

  // Calculate distance and ETA
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distance = helperLocation
    ? calculateDistance(alertLat, alertLng, helperLocation.lat, helperLocation.lng)
    : null;
  
  const eta = distance ? Math.ceil(distance / 0.5) : null; // Assuming 30 km/h average speed

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-full h-full max-w-full md:max-w-4xl md:h-[90vh] p-0 gap-0 m-0 md:m-4">
        <DialogHeader className="p-3 md:p-4 border-b bg-background z-20 flex-shrink-0">
          <DialogTitle className="flex items-center justify-between text-base md:text-lg">
            <span>Helper Tracking</span>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 md:h-10 md:w-10">
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden min-h-0">
          {/* Loading Skeleton */}
          {(!isMapLoaded || isTokenLoading) && (
            <div className="absolute inset-0 bg-muted z-30 flex flex-col items-center justify-center">
              <SerkleLoader size="md" className="text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          )}
          
          {/* Map */}
          <div ref={mapContainer} className="absolute inset-0" />

          {/* Helper Info Card - Mobile First */}
          {acceptedHelper && helperProfile && (
            <Card className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-4 z-10 p-3 md:p-4 shadow-lg">
              <div className="flex items-start gap-3 md:gap-4">
                <Avatar className="h-12 w-12 md:h-16 md:w-16 border-2 border-green-500 flex-shrink-0">
                  <AvatarImage src={helperProfile.profiles?.avatar_url || ''} />
                  <AvatarFallback style={{ backgroundColor: helperProfile.profiles?.avatar_color }}>
                    {helperProfile.profiles?.initials || 'H'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm md:text-lg truncate">
                        {helperProfile.profiles?.name || 'Helper'}
                      </h3>
                      <Badge className="bg-green-500 text-white text-xs mt-1">
                        On the way
                      </Badge>
                    </div>
                    {distance && eta && (
                      <div className="text-left md:text-right">
                        <div className="text-xl md:text-2xl font-bold text-blue-600">
                          {eta} min
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {distance.toFixed(1)} km away
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-2 text-xs md:text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                    <span className="truncate">Tracking live location</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Request in Progress - Mobile First */}
          {autoRequest.isRequesting && !acceptedHelper && (
            <Card className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 z-10 p-3 md:p-4 shadow-lg bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 md:gap-3">
                <SerkleLoader size="xs" className="text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm md:text-base">Requesting Helper...</h4>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">
                    Helper {autoRequest.currentHelperIndex}/{autoRequest.totalHelpers} • {autoRequest.timeRemaining}s
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={autoRequest.stopRequesting}
                  className="flex-shrink-0 text-xs md:text-sm"
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {/* No Helper Yet - Start Request - Mobile First */}
          {!autoRequest.isRequesting && !acceptedHelper && (
            <Card className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 z-10 p-3 md:p-4 shadow-lg">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white h-10 md:h-12 text-sm md:text-base"
                onClick={autoRequest.startRequesting}
                disabled={!helpers || helpers.length === 0}
              >
                <Phone className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                Request Helper Automatically
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                We'll contact nearby helpers until someone accepts
              </p>
            </Card>
          )}
        </div>

        {/* Auto Request Progress Modal */}
        <AutoRequestProgress
          isRequesting={autoRequest.isRequesting}
          currentHelper={autoRequest.currentHelper}
          timeRemaining={autoRequest.timeRemaining}
          totalElapsed={autoRequest.totalElapsed}
          currentHelperIndex={autoRequest.currentHelperIndex}
          totalHelpers={autoRequest.totalHelpers}
          onCancel={autoRequest.stopRequesting}
        />
      </DialogContent>
    </Dialog>
  );
};
