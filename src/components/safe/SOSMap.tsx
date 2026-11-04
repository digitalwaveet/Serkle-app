import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Navigation, Users, Clock, Target, AlertTriangle, Share2, Activity, Heart, Shield, Flame, Car, Tornado, Phone } from 'lucide-react';
import { useSOSAlerts } from '@/hooks/useSOSAlerts';
import { useSOSHelpers } from '@/hooks/useSOSHelpers';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useLiveLocationTracking } from '@/hooks/useLiveLocationTracking';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useAutoHelperRequest } from '@/hooks/useAutoHelperRequest';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { NearbyHelpersList } from './NearbyHelpersList';
import { IncomingHelperRequestAlert } from './IncomingHelperRequestAlert';
import { AutoRequestProgress } from './AutoRequestProgress';

interface SOSMapProps {
  userLat?: number | null;
  userLng?: number | null;
}

export const SOSMap: React.FC<SOSMapProps> = ({ userLat, userLng }) => {
  const [selectedEmergency, setSelectedEmergency] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  const { latitude, longitude, refreshLocation } = useGeolocation();
  const currentUserLat = userLat || latitude;
  const currentUserLng = userLng || longitude;
  const { alerts } = useSOSAlerts(currentUserLat, currentUserLng);
  const { respondToAlert } = useSOSHelpers();
  const queryClient = useQueryClient();
  const { data: mapboxToken, isLoading: isLoadingToken } = useMapboxToken();
  const { location: liveLocation, isTracking } = useLiveLocationTracking({ 
    enabled: false // Only track when user creates an alert
  });

  // Fetch all active helpers with their current locations - OPTIMIZED
  const { data: activeHelpers } = useQuery({
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

  // Initialize Mapbox with optimizations
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    console.log('Initializing Mapbox with token');
    mapboxgl.accessToken = mapboxToken;

    const userLatitude = currentUserLat || 9.03; // Default to Addis Ababa
    const userLongitude = currentUserLng || 38.74;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [userLongitude, userLatitude],
      zoom: 12,
      attributionControl: false,
      // Performance optimizations
      preserveDrawingBuffer: false,
      refreshExpiredTiles: false,
      fadeDuration: 0,
    });

    // Wait for the style to load before adding controls
    map.current.on('load', () => {
      console.log('Map style loaded successfully');
      // Pre-render layers for better performance
      map.current?.resize();
    });

    map.current.on('error', (e) => {
      console.error('Map error:', e);
      // Don't show error for minor issues
      if (e.error?.message && !e.error.message.includes('NetworkError')) {
        toast.error('Map loading issue detected');
      }
    });

    // Add navigation controls after map loads
    map.current.addControl(new mapboxgl.NavigationControl({
      showCompass: true,
      showZoom: true,
      visualizePitch: false
    }), 'top-right');
    
    map.current.addControl(new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000
      },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: false
    }), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken]);

  // Update user location marker
  useEffect(() => {
    if (!map.current || !currentUserLat || !currentUserLng) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([currentUserLng, currentUserLat]);
    } else {
      const userEl = document.createElement('div');
      userEl.className = 'relative';
      userEl.innerHTML = `
        <div class="relative">
          <div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg"></div>
          <div class="absolute inset-0 bg-blue-400 rounded-full animate-pulse opacity-50 scale-150"></div>
        </div>
      `;

      userMarkerRef.current = new mapboxgl.Marker({ element: userEl })
        .setLngLat([currentUserLng, currentUserLat])
        .addTo(map.current);
    }

    // Center map on user location on first load
    if (map.current.getZoom() === 14) {
      map.current.flyTo({
        center: [currentUserLng, currentUserLat],
        zoom: 14,
      });
    }
  }, [currentUserLat, currentUserLng]);

  const getUrgencyColor = (priority: string) => {
    const colors = {
      low: '#eab308',
      medium: '#f97316',
      high: '#ef4444',
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

  // Update markers for alerts and helpers - OPTIMIZED
  useEffect(() => {
    if (!map.current || !alerts) return;
    if (!map.current.isStyleLoaded()) return; // Wait for style to load

    // Clear existing alert markers efficiently
    Object.keys(markersRef.current).forEach(key => {
      if (key.startsWith('alert-')) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    const activeEmergencies = alerts.filter(alert => alert.status === 'active');
    
    console.log('Rendering', activeEmergencies.length, 'emergency markers');

    // Batch create emergency markers
    activeEmergencies.forEach(emergency => {
      if (!emergency.location_lat || !emergency.location_lng) {
        console.warn('Emergency missing location:', emergency.id);
        return;
      }

      const markerEl = document.createElement('div');
      markerEl.className = 'relative cursor-pointer';
      
      const urgencyColor = getUrgencyColor(emergency.urgency);
      const IconComponent = getTypeIcon(emergency.sos_type);
      
      markerEl.innerHTML = `
        <div class="relative">
          <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${emergency.urgency === 'high' ? 'animate-pulse' : ''}" style="background-color: ${urgencyColor}">
            <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </div>
          ${emergency.urgency === 'high' ? '<div class="absolute inset-0 rounded-full animate-ping opacity-40" style="background-color: ' + urgencyColor + '"></div>' : ''}
        </div>
      `;

      try {
        const marker = new mapboxgl.Marker({ element: markerEl })
          .setLngLat([emergency.location_lng, emergency.location_lat])
          .addTo(map.current!);

        // Add popup on click
        markerEl.addEventListener('click', () => {
          setSelectedEmergency(emergency.id);
          map.current?.flyTo({
            center: [emergency.location_lng!, emergency.location_lat!],
            zoom: 16,
            duration: 1000,
          });
        });

        markersRef.current[`alert-${emergency.id}`] = marker;
      } catch (error) {
        console.error('Error adding marker for emergency:', emergency.id, error);
      }
    });

    // Fit map to show all markers if there are any
    if (activeEmergencies.length > 0 && currentUserLat && currentUserLng) {
      const bounds = new mapboxgl.LngLatBounds();
      
      // Add user location
      bounds.extend([currentUserLng, currentUserLat]);
      
      // Add all emergency locations
      activeEmergencies.forEach(e => {
        if (e.location_lat && e.location_lng) {
          bounds.extend([e.location_lng, e.location_lat]);
        }
      });

      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
        duration: 1000
      });
    }
  }, [alerts, currentUserLat, currentUserLng]);

  // Update helper markers
  useEffect(() => {
    if (!map.current || !activeHelpers) return;

    // Clear existing helper markers
    Object.keys(markersRef.current).forEach(key => {
      if (key.startsWith('helper-')) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    // Add helper markers
    activeHelpers.forEach((helper: any) => {
      if (!helper.location_lat || !helper.location_lng) return;

      const helperEl = document.createElement('div');
      const profile = helper.profiles;
      helperEl.className = 'relative cursor-pointer';
      helperEl.innerHTML = `
        <div class="relative">
          <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white text-xs font-semibold text-white" style="background-color: ${profile?.avatar_color || '#10b981'}">
            ${profile?.initials || 'H'}
          </div>
          <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: helperEl })
        .setLngLat([helper.location_lng, helper.location_lat])
        .addTo(map.current!);

      markersRef.current[`helper-${helper.user_id}`] = marker;
    });
  }, [activeHelpers]);

  // Set up realtime subscriptions
  useEffect(() => {
    const alertsChannel = supabase
      .channel('sos-alerts-map-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_alerts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
        }
      )
      .subscribe();

    const helpersChannel = supabase
      .channel('helper-profiles-map-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'helper_profiles' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['active-helpers'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertsChannel);
      supabase.removeChannel(helpersChannel);
    };
  }, [queryClient]);

  const selectedEmergencyData = alerts?.find(e => e.id === selectedEmergency);

  // Auto helper request system
  const autoRequest = useAutoHelperRequest({
    helpers: activeHelpers || [],
    alertId: selectedEmergency || '',
    userLat: selectedEmergencyData?.location_lat,
    userLng: selectedEmergencyData?.location_lng,
  });

  const handleShareLocation = () => {
    if (currentUserLat && currentUserLng) {
      const locationUrl = `https://www.google.com/maps?q=${currentUserLat},${currentUserLng}`;
      navigator.clipboard.writeText(locationUrl);
      toast.success('Location copied to clipboard');
    } else {
      toast.error('Location not available');
    }
  };

  const handleNavigate = () => {
    if (selectedEmergencyData?.location_lat && selectedEmergencyData?.location_lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${selectedEmergencyData.location_lat},${selectedEmergencyData.location_lng}`,
        '_blank'
      );
    }
  };

  if (isLoadingToken) {
    return (
      <Card className="w-full h-[600px] relative overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <SerkleLoader size="md" className="text-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <Card className="relative h-[500px] overflow-hidden">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Tracking Status */}
        {isTracking && (
          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 z-10 animate-pulse">
            <Activity className="h-4 w-4" />
            Live Tracking Active
          </div>
        )}

        {/* Action Buttons */}
        <div className="absolute bottom-4 left-4 z-10 flex gap-2">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            onClick={refreshLocation}
          >
            <Target className="h-4 w-4 mr-1" />
            {currentUserLat && currentUserLng ? 'Refresh' : 'Find Me'}
          </Button>
          
          {selectedEmergencyData && !autoRequest.isRequesting && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg animate-pulse"
              onClick={() => autoRequest.startRequesting()}
              disabled={!activeHelpers || activeHelpers.length === 0}
            >
              <Phone className="h-4 w-4 mr-1" />
              Request Helper
            </Button>
          )}
        </div>
      </Card>

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

      {/* Nearby Helpers List - Ride-hailing style */}
      {selectedEmergencyData && !autoRequest.isRequesting && (
        <NearbyHelpersList
          helpers={activeHelpers || []}
          alertId={selectedEmergencyData.id}
          userLat={selectedEmergencyData.location_lat}
          userLng={selectedEmergencyData.location_lng}
        />
      )}

      {/* Map Legend */}
      <Card className="p-3">
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-500" />
          Map Legend
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-red-500 rounded-full border border-white flex items-center justify-center">
              <AlertTriangle className="h-2 w-2 text-white" />
            </div>
            <span>High Priority SOS</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-orange-500 rounded-full border border-white flex items-center justify-center">
              <AlertTriangle className="h-2 w-2 text-white" />
            </div>
            <span>Medium Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-green-500 rounded-full border border-white flex items-center justify-center">
              <Users className="h-2 w-2 text-white" />
            </div>
            <span>Available Helpers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-blue-500 rounded-full border border-white" />
            <span>Your Location</span>
          </div>
        </div>
      </Card>

      {/* Emergency Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <div className="text-lg font-bold text-red-600">
            {alerts?.filter(e => e.status === 'active').length || 0}
          </div>
          <div className="text-xs text-muted-foreground">Active</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-bold text-green-600">{activeHelpers?.length || 0}</div>
          <div className="text-xs text-muted-foreground">Helpers</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-bold text-blue-600">
            {activeHelpers && activeHelpers.length > 0 ? '~5m' : 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground">Avg Response</div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={handleShareLocation}>
          <Share2 className="h-4 w-4 mr-1" />
          Share Location
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={handleNavigate}
          disabled={!selectedEmergencyData}
        >
          <Navigation className="h-4 w-4 mr-1" />
          Navigate
        </Button>
      </div>

      {/* Selected Emergency Details */}
      {selectedEmergencyData && (
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{selectedEmergencyData.profiles?.full_name || 'Anonymous'}</h3>
                <Badge className={`text-white text-xs`} style={{ backgroundColor: getUrgencyColor(selectedEmergencyData.urgency) }}>
                  {selectedEmergencyData.urgency} priority
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(selectedEmergencyData.created_at), { addSuffix: true })}
              </span>
            </div>
            
            <p className="text-sm text-foreground">{selectedEmergencyData.description}</p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {selectedEmergencyData.distance ? `${selectedEmergencyData.distance} km` : selectedEmergencyData.location_address}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {selectedEmergencyData.sos_type}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (selectedEmergencyData.id) {
                    toast.success('Responding to alert...');
                  }
                }}
              >
                I can help
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={handleNavigate}>
                <Navigation className="h-4 w-4 mr-1" />
                Navigate
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
