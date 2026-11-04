import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Users, Clock, Target, Heart, Shield, Flame, Car, Tornado, AlertTriangle, MessageCircle, X } from 'lucide-react';
import { useSOSAlerts } from '@/hooks/useSOSAlerts';
import { useSOSHelpers } from '@/hooks/useSOSHelpers';
import { useHelperProfile } from '@/hooks/useHelperProfile';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SOSMessaging } from './SOSMessaging';
import { LegalDisclaimerModal } from './LegalDisclaimerModal';
import { useMapboxToken } from '@/hooks/useMapboxToken';

interface SOSMapInteractiveProps {
  userLat?: number | null;
  userLng?: number | null;
}

export const SOSMapInteractive: React.FC<SOSMapInteractiveProps> = ({ userLat, userLng }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  
  const [selectedEmergency, setSelectedEmergency] = useState<string | null>(null);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showLegalDisclaimer, setShowLegalDisclaimer] = useState(false);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userResponses, setUserResponses] = useState<Set<string>>(new Set());
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const { latitude: userLat2, longitude: userLng2, refreshLocation, error: geoError, loading: geoLoading } = useGeolocation();
  const currentUserLat = userLat || userLat2;
  const currentUserLng = userLng || userLng2;
  const { alerts } = useSOSAlerts(currentUserLat, currentUserLng);
  const { respondToAlert, checkExistingResponse } = useSOSHelpers();
  const { upsertProfile } = useHelperProfile(userId || undefined);
  const { data: mapboxToken, isLoading: isTokenLoading } = useMapboxToken();

  useEffect(() => {
    refreshLocation();
  }, []);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Check which alerts the current user has already responded to
  useEffect(() => {
    const checkUserResponses = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alerts) return;

      const responses = new Set<string>();
      for (const alert of alerts) {
        const hasResponded = await checkExistingResponse(alert.id, user.id);
        if (hasResponded) {
          responses.add(alert.id);
        }
      }
      setUserResponses(responses);
    };

    checkUserResponses();
  }, [alerts, checkExistingResponse]);

  // Show location permission prompt when needed
  useEffect(() => {
    if (!currentUserLat || !currentUserLng) {
      setShowLocationPrompt(Boolean(geoError));
    } else {
      setShowLocationPrompt(false);
    }
  }, [currentUserLat, currentUserLng, geoError]);

  // Fetch all active helpers with their current locations - OPTIMIZED
  const { data: activeHelpers, refetch: refetchHelpers } = useQuery({
    queryKey: ['active-helpers'],
    queryFn: async () => {
      // Fetch helpers first
      const { data: helpersData, error: helpersError } = await supabase
        .from('helper_profiles')
        .select('user_id, location_lat, location_lng, availability_status')
        .eq('is_available', true)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .limit(50);

      if (helpersError) {
        console.error('Error fetching helpers:', helpersError);
        return [];
      }

      if (!helpersData || helpersData.length === 0) {
        return [];
      }

      // Get unique user IDs
      const userIds = helpersData.map(h => h.user_id);

      // Batch fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, initials, avatar_color')
        .in('id', userIds);

      // Create profile map
      const profileMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>);

      // Combine helpers with profiles
      const helpersWithProfiles = helpersData.map(helper => ({
        ...helper,
        profiles: profileMap[helper.user_id] || null
      }));

      return helpersWithProfiles;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
    staleTime: 10000,
    gcTime: 300000,
  });

  // Real-time subscription for map updates
  useEffect(() => {
    const channel = supabase
      .channel('map-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sos_alerts',
        },
        () => {
          // Alerts are automatically refetched via the useSOSAlerts hook
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'helper_profiles',
        },
        () => {
          refetchHelpers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchHelpers]);
  
  const activeEmergencies = alerts.filter(e => e.status === 'active');

  const getUrgencyColor = (priority: string) => {
    const colors = {
      low: 'bg-yellow-500',
      medium: 'bg-orange-500',
      high: 'bg-red-500',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      medical: Heart,
      safety: Shield,
      fire: Flame,
      accident: Car,
      natural: Tornado,
      other: AlertTriangle,
    };
    return icons[type as keyof typeof icons] || AlertTriangle;
  };

  // Initialize map with optimizations
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    setIsMapLoaded(false);
    mapboxgl.accessToken = mapboxToken;

    // Determine initial center - use user location, first emergency, or default
    let initialCenter: [number, number] = [0, 0];
    let initialZoom = 2;

    if (currentUserLat && currentUserLng) {
      initialCenter = [currentUserLng, currentUserLat];
      initialZoom = 13;
    } else if (activeEmergencies.length > 0 && activeEmergencies[0].location_lat && activeEmergencies[0].location_lng) {
      initialCenter = [activeEmergencies[0].location_lng, activeEmergencies[0].location_lat];
      initialZoom = 13;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: initialCenter,
        zoom: initialZoom,
        // Performance optimizations
        antialias: false,
        preserveDrawingBuffer: false,
        refreshExpiredTiles: false,
        fadeDuration: 0,
        attributionControl: false,
      });

      map.current.addControl(new mapboxgl.NavigationControl({ 
        showCompass: true, 
        showZoom: true,
        visualizePitch: false 
      }), 'top-right');

      map.current.on('load', () => {
        console.log('Map loaded successfully');
        setIsMapLoaded(true);
        // Pre-render for better performance
        map.current?.resize();
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        // Only show error for critical issues
        if (e.error?.message && !e.error.message.includes('NetworkError')) {
          toast.error('Map loading issue');
        }
        setIsMapLoaded(true);
      });

    } catch (error) {
      console.error('Failed to initialize map:', error);
      toast.error('Unable to load map');
      setIsMapLoaded(true);
    }

    return () => {
      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setIsMapLoaded(false);
    };
  }, [mapboxToken, activeEmergencies]);

  // Update markers when emergencies or helpers change
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Add user location marker
    if (currentUserLat && currentUserLng) {
      const userEl = document.createElement('div');
      userEl.className = 'user-location-marker';
      userEl.innerHTML = `
        <div class="relative">
          <div class="w-5 h-5 bg-blue-500 rounded-full border-3 border-white shadow-lg"></div>
          <div class="absolute inset-0 bg-blue-400 rounded-full animate-pulse opacity-30 scale-150"></div>
        </div>
      `;
      markersRef.current['user'] = new mapboxgl.Marker({ element: userEl })
        .setLngLat([currentUserLng, currentUserLat])
        .addTo(map.current);
    }

    // Add emergency markers
    activeEmergencies.forEach(emergency => {
      if (!emergency.location_lat || !emergency.location_lng) return;

      const IconComponent = getTypeIcon(emergency.sos_type);
      const el = document.createElement('div');
      el.className = 'emergency-marker cursor-pointer';
      el.innerHTML = `
        <div class="relative">
          <div class="h-12 w-12 ${getUrgencyColor(emergency.urgency)} rounded-full flex items-center justify-center text-white shadow-xl border-3 border-white">
            <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              ${emergency.sos_type === 'medical' ? '<path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/>' : '<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>'}
            </svg>
          </div>
          ${emergency.urgency === 'high' ? '<div class="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40"></div>' : ''}
          ${emergency.helper_count > 0 ? `<div class="absolute -top-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center"><span class="text-xs font-bold text-white">${emergency.helper_count}</span></div>` : ''}
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedEmergency(selectedEmergency === emergency.id ? null : emergency.id);
      });

      markersRef.current[emergency.id] = new mapboxgl.Marker({ element: el })
        .setLngLat([emergency.location_lng, emergency.location_lat])
        .addTo(map.current!);
    });

    // Add helper markers
    activeHelpers?.forEach((helper: any) => {
      if (!helper.location_lat || !helper.location_lng) return;

      const profile = helper.profiles;
      const el = document.createElement('div');
      el.className = 'helper-marker';
      el.innerHTML = `
        <div class="relative">
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white text-sm font-semibold" style="background-color: ${profile?.avatar_color || '#10b981'}">
            ${profile?.initials || 'H'}
          </div>
          <div class="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
        </div>
      `;

      markersRef.current[`helper-${helper.user_id}`] = new mapboxgl.Marker({ element: el })
        .setLngLat([helper.location_lng, helper.location_lat])
        .addTo(map.current!);
    });

    // Fit map to show all markers
    if (activeEmergencies.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      
      if (currentUserLat && currentUserLng) {
        bounds.extend([currentUserLng, currentUserLat]);
      }
      
      activeEmergencies.forEach(emergency => {
        if (emergency.location_lat && emergency.location_lng) {
          bounds.extend([emergency.location_lng, emergency.location_lat]);
        }
      });

      map.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
  }, [activeEmergencies, activeHelpers, isMapLoaded, currentUserLat, currentUserLng, selectedEmergency]);

  const selectedEmergencyData = alerts.find(e => e.id === selectedEmergency);

  const handleNavigate = (lat?: number, lng?: number) => {
    const targetLat = lat || selectedEmergencyData?.location_lat;
    const targetLng = lng || selectedEmergencyData?.location_lng;
    
    if (targetLat && targetLng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`,
        '_blank'
      );
    }
  };

  const handleRespond = async (alertId: string) => {
    if (!currentUserLat || !currentUserLng) {
      toast.error('Location not available');
      return;
    }
    
    // Check if user has accepted helper terms
    const hasAcceptedTerms = localStorage.getItem('helper_terms_accepted');
    if (!hasAcceptedTerms) {
      setPendingAlertId(alertId);
      setShowLegalDisclaimer(true);
      return;
    }
    
    respondToAlert.mutate(
      {
        alert_id: alertId,
        current_lat: currentUserLat,
        current_lng: currentUserLng,
      },
      {
        onSuccess: () => {
          toast.success('Response sent!');
          setUserResponses(prev => new Set([...prev, alertId]));
        },
      }
    );
  };

  const handleAcceptTerms = async () => {
    try {
      // Store acceptance in localStorage
      localStorage.setItem('helper_terms_accepted', 'true');
      
      // Update helper profile in database
      await upsertProfile.mutateAsync({
        is_available: true,
        availability_status: 'available',
      });
      
      setShowLegalDisclaimer(false);
      
      // If there's a pending alert, respond to it now
      if (pendingAlertId && currentUserLat && currentUserLng) {
        respondToAlert.mutate(
          {
            alert_id: pendingAlertId,
            current_lat: currentUserLat,
            current_lng: currentUserLng,
          },
          {
            onSuccess: () => {
              toast.success('Response sent!');
              setUserResponses(prev => new Set([...prev, pendingAlertId]));
              setPendingAlertId(null);
            },
          }
        );
      }
    } catch (error) {
      toast.error('Failed to accept terms. Please try again.');
    }
  };

  const handleDeclineTerms = () => {
    setShowLegalDisclaimer(false);
    setPendingAlertId(null);
    toast.info('You must accept the terms to respond to emergencies');
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Map Container */}
      <Card className="relative h-[400px] sm:h-[500px] overflow-hidden">
        {/* Loading Skeleton */}
        {(!isMapLoaded || isTokenLoading) && (
          <div className="absolute inset-0 bg-muted z-30 flex flex-col items-center justify-center">
            <SerkleLoader size="md" className="text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        )}
        
        {/* Map */}
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Location Button */}
        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-40">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-xs sm:text-sm"
            onClick={() => refreshLocation()}
          >
            <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden xs:inline">{currentUserLat && currentUserLng ? 'Refresh' : 'Find Me'}</span>
          </Button>
        </div>

        {/* Location Permission/Timeout Prompt */}
        {showLocationPrompt && !currentUserLat && !currentUserLng && (
          <Card className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-auto z-40 max-w-md">
            <div className="p-3 sm:p-4">
              <div className="text-sm text-muted-foreground mb-3">
                {geoError || "We couldn't detect your location. Please enable location to see nearby emergencies."}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => refreshLocation()}>
                  Enable Location
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowLocationPrompt(false)}>
                  Continue without location
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Selected Emergency Popup - Mobile First */}
        {selectedEmergencyData && (
          <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 z-40 max-w-md mx-auto">
            <Card className="p-3 sm:p-4 border-l-4 border-l-red-500 shadow-2xl max-h-[40vh] sm:max-h-[50vh] overflow-y-auto">
              <button 
                onClick={() => setSelectedEmergency(null)}
                className="absolute top-2 right-2 z-10"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
              
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-start justify-between pr-6 gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
                      {selectedEmergencyData.profiles?.name || 'Anonymous'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                      <Badge className={`${getUrgencyColor(selectedEmergencyData.urgency)} text-white text-[10px] sm:text-xs`}>
                        {selectedEmergencyData.urgency}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] sm:text-xs ${
                          selectedEmergencyData.status === 'active' 
                            ? 'bg-red-50 text-red-700 border-red-200' 
                            : selectedEmergencyData.status === 'responding'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                        }`}
                      >
                        {selectedEmergencyData.status}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(selectedEmergencyData.created_at), { addSuffix: true }).replace('about ', '')}
                  </span>
                </div>
                
                <p className="text-xs sm:text-sm text-foreground line-clamp-2">
                  {selectedEmergencyData.description}
                </p>
                
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{selectedEmergencyData.distance ? `${selectedEmergencyData.distance} km` : selectedEmergencyData.location_address}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span className="capitalize">{selectedEmergencyData.sos_type}</span>
                  </div>
                  {selectedEmergencyData.helper_count > 0 && (
                    <div className="flex items-center gap-1 text-green-600 font-medium">
                      <Users className="h-3 w-3 flex-shrink-0" />
                      <span>{selectedEmergencyData.helper_count}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {userResponses.has(selectedEmergencyData.id) ? (
                    <Button 
                      size="sm" 
                      className="flex-[1_1_100%] sm:flex-1 bg-green-100 text-green-700 border-green-300 cursor-not-allowed text-xs sm:text-sm min-h-[36px]"
                      disabled
                    >
                      ✓ Responding
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      className="flex-[1_1_100%] sm:flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 text-xs sm:text-sm min-h-[36px]"
                      onClick={() => handleRespond(selectedEmergencyData.id)}
                      disabled={respondToAlert.isPending}
                    >
                      {respondToAlert.isPending ? (
                        <SerkleLoader size="xs" className="text-white mr-1" />
                      ) : (
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      )}
                      I can help
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-xs sm:text-sm min-h-[36px]"
                    onClick={() => handleNavigate(selectedEmergencyData.location_lat, selectedEmergencyData.location_lng)}
                  >
                    <Navigation className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden xs:inline">Navigate</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-w-[36px] min-h-[36px]"
                    onClick={() => {
                      setShowMessaging(true);
                    }}
                  >
                    <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </Card>

      {/* Map Legend - Mobile First */}
      <Card className="p-3">
        <h3 className="font-medium text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-2">
          <Target className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
          Map Legend
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="h-3 w-3 sm:h-4 sm:w-4 bg-red-500 rounded-full border border-white flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-2 w-2 text-white" />
            </div>
            <span className="truncate">High Priority</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="h-3 w-3 sm:h-4 sm:w-4 bg-orange-500 rounded-full border border-white flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-2 w-2 text-white" />
            </div>
            <span className="truncate">Medium</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="h-3 w-3 sm:h-4 sm:w-4 bg-green-500 rounded-full border border-white flex items-center justify-center flex-shrink-0">
              <Users className="h-2 w-2 text-white" />
            </div>
            <span className="truncate">Helpers</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="h-3 w-3 sm:h-4 sm:w-4 bg-blue-500 rounded-full border border-white flex-shrink-0" />
            <span className="truncate">Your Location</span>
          </div>
        </div>
      </Card>

      {/* Emergency Stats - Mobile First */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-2 sm:p-3 text-center">
          <div className="text-base sm:text-lg font-bold text-red-600">
            {activeEmergencies.length}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Active</div>
        </Card>
        <Card className="p-2 sm:p-3 text-center">
          <div className="text-base sm:text-lg font-bold text-green-600">{activeHelpers?.length || 0}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Helpers</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-bold text-blue-600">
            {activeHelpers && activeHelpers.length > 0 ? '~5m' : 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground">Avg Response</div>
        </Card>
      </div>

      {/* Messaging Dialog */}
      {selectedEmergency && (
        <SOSMessaging
          alertId={selectedEmergency}
          isOpen={showMessaging}
          onClose={() => setShowMessaging(false)}
        />
      )}

      {/* Legal Disclaimer Modal */}
      <LegalDisclaimerModal
        isOpen={showLegalDisclaimer}
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
        type="helper"
      />
    </div>
  );
};
