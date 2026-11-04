import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Clock, Users, MessageCircle, Navigation, Radio, Map, Heart, Shield, Flame, Car, Tornado, Zap, CheckCircle, XCircle, Flag, Edit } from 'lucide-react';
import { LazyMap } from './LazyMap';
import { SOSMessaging } from './SOSMessaging';
import { AbuseReportModal } from './AbuseReportModal';
import { EditAlertModal } from './EditAlertModal';
import { HelperTrackingModal } from './HelperTrackingModal';
import { LegalDisclaimerModal } from './LegalDisclaimerModal';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSOSAlerts } from '@/hooks/useSOSAlerts';
import { useSOSHelpers } from '@/hooks/useSOSHelpers';
import { useHelperProfile } from '@/hooks/useHelperProfile';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export const SOSNearbyView: React.FC = () => {
  const [showMap, setShowMap] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showAbuseReport, setShowAbuseReport] = useState(false);
  const [showEditAlert, setShowEditAlert] = useState(false);
  const [showHelperTracking, setShowHelperTracking] = useState(false);
  const [showLegalDisclaimer, setShowLegalDisclaimer] = useState(false);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userResponses, setUserResponses] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const pageSize = 10;
  
  const { latitude, longitude, loading: locationLoading } = useGeolocation();
  const { alerts, isLoading: alertsLoading, updateAlertStatus } = useSOSAlerts(latitude, longitude);
  const { respondToAlert, checkExistingResponse } = useSOSHelpers();
  const { upsertProfile } = useHelperProfile(userId || undefined);

  // Fetch available helpers with optimized query
  const { data: availableHelpers } = useQuery({
    queryKey: ['available-helpers'],
    queryFn: async () => {
      // Fetch helpers
      const { data: helpersData, error: helpersError } = await supabase
        .from('helper_profiles')
        .select('user_id, location_lat, location_lng, availability_status')
        .eq('is_available', true)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .limit(20);

      if (helpersError) {
        console.error('Error fetching helpers:', helpersError);
        throw helpersError;
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

      console.log('Fetched helpers:', helpersWithProfiles.length);
      return helpersWithProfiles;
    },
    staleTime: 15000,
    gcTime: 300000,
    refetchInterval: 10000,
  });

  // Get current user
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Check which alerts the current user has already responded to
  React.useEffect(() => {
    const checkUserResponses = async () => {
      if (!userId || !alerts) return;

      const responses = new Set<string>();
      for (const alert of alerts) {
        const hasResponded = await checkExistingResponse(alert.id, userId);
        if (hasResponded) {
          responses.add(alert.id);
        }
      }
      setUserResponses(responses);
    };

    checkUserResponses();
  }, [alerts, userId, checkExistingResponse]);

  const getUrgencyColor = (priority: string) => {
    const colors = {
      low: 'bg-amber-100 text-amber-800 border-amber-200',
      medium: 'bg-orange-100 text-orange-800 border-orange-200',
      high: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getUrgencyDot = (priority: string) => {
    const colors = {
      low: 'bg-amber-500',
      medium: 'bg-orange-500',
      high: 'bg-red-500',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      medical: 'bg-gradient-to-br from-red-500 to-red-600',
      safety: 'bg-gradient-to-br from-orange-500 to-orange-600',
      fire: 'bg-gradient-to-br from-red-600 to-red-700',
      accident: 'bg-gradient-to-br from-blue-500 to-blue-600',
      natural: 'bg-gradient-to-br from-purple-500 to-purple-600',
      lost: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
      emergency: 'bg-gradient-to-br from-red-500 to-red-600',
      other: 'bg-gradient-to-br from-gray-500 to-gray-600',
    };
    return colors[type as keyof typeof colors] || colors.other;
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      medical: Heart,
      safety: Shield,
      fire: Flame,
      accident: Car,
      natural: Tornado,
      lost: MapPin,
      emergency: Zap,
      other: Zap,
    };
    return icons[type as keyof typeof icons] || Zap;
  };

  const handleRespond = async (alertId: string) => {
    if (!latitude || !longitude) {
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
        current_lat: latitude,
        current_lng: longitude,
      },
      {
        onSuccess: () => {
          toast.success('Response sent! Stay safe.', {
            icon: '✓',
            duration: 3000,
          });
          setUserResponses(prev => new Set(prev).add(alertId));
        },
        onError: (error: any) => {
          const errorMessage = error?.message || 'Failed to send response. Please try again.';
          toast.error(errorMessage);
        },
      }
    );
  };

  const handleResolveAlert = async (alertId: string) => {
    updateAlertStatus.mutate(
      { alertId, status: 'resolved' },
      {
        onSuccess: () => {
          toast.success('Emergency resolved successfully', { icon: '✓' });
        },
        onError: (error: any) => {
          toast.error(error?.message || 'Failed to resolve alert');
        },
      }
    );
  };

  const handleCancelAlert = async (alertId: string) => {
    updateAlertStatus.mutate(
      { alertId, status: 'cancelled' },
      {
        onSuccess: () => {
          toast.success('Alert cancelled', { icon: '✓' });
        },
        onError: (error: any) => {
          toast.error(error?.message || 'Failed to cancel alert');
        },
      }
    );
  };

  const handleNavigate = (lat: number, lng: number) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank'
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
      if (pendingAlertId && latitude && longitude) {
        respondToAlert.mutate(
          {
            alert_id: pendingAlertId,
            current_lat: latitude,
            current_lng: longitude,
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

  const isAlertCreator = (emergency: any) => {
    return userId && emergency.user_id === userId;
  };

  const activeEmergencies = alerts.filter(e => e.status === 'active');
  
  // Pagination
  const totalPages = Math.ceil(activeEmergencies.length / pageSize);
  const paginatedEmergencies = activeEmergencies.slice(page * pageSize, (page + 1) * pageSize);
  
  const handleNextPage = () => {
    if (page < totalPages - 1) {
      setPage(page + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const handlePrevPage = () => {
    if (page > 0) {
      setPage(page - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Location Loading/Error State */}
      {locationLoading && !latitude && !longitude && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <SerkleLoader size="xs" className="text-current" />
            <div>
              <p className="font-medium text-blue-900">Getting your location...</p>
              <p className="text-xs text-blue-700">This may take a few seconds</p>
            </div>
          </div>
        </Card>
      )}

      {/* Header with Live Badge and Map Toggle */}
      <div className="px-3 sm:px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Badge className="bg-red-500 text-white animate-pulse shrink-0">
            <Radio className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
          <h2 className="text-sm sm:text-lg font-semibold text-foreground truncate">
            {activeEmergencies.length} Active
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMap(!showMap)}
          className="text-xs shrink-0 min-h-[44px]"
        >
          <Map className="h-4 w-4 mr-1" />
          <span className="hidden xs:inline">{showMap ? 'List' : 'Map'}</span>
        </Button>
      </div>

      {showMap ? (
        <div className="px-2 sm:px-4">
          <LazyMap userLat={latitude} userLng={longitude} />
        </div>
      ) : (
        <div className="px-2 sm:px-4 space-y-3">
          {alertsLoading ? (
            <Card className="p-8 text-center">
              <div className="text-muted-foreground">Loading emergencies...</div>
            </Card>
          ) : activeEmergencies.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="font-medium mb-2">No Active Emergencies</h3>
                <p className="text-sm">Your community is safe right now</p>
              </div>
            </Card>
          ) : (
            <>
              {paginatedEmergencies.map((emergency) => (
                <Card key={emergency.id} className="p-3 sm:p-4 border-l-4 border-l-red-500">
                <div className="space-y-3">
                   {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl ${getTypeColor(emergency.sos_type)} shadow-lg flex items-center justify-center text-white backdrop-blur-sm`}>
                          {React.createElement(getTypeIcon(emergency.sos_type), { className: "h-5 w-5 sm:h-6 sm:w-6" })}
                        </div>
                        <div className={`absolute -top-1 -right-1 h-3 w-3 sm:h-4 sm:w-4 ${getUrgencyDot(emergency.urgency)} rounded-full border-2 border-white shadow-sm ${emergency.urgency === 'high' ? 'animate-pulse' : ''}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base text-foreground truncate">
                          {emergency.profiles?.name || 'Anonymous'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                          <Badge className={`${getUrgencyColor(emergency.urgency)} text-[10px] sm:text-xs`}>
                            {emergency.urgency}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] sm:text-xs capitalize">
                            {emergency.sos_type}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] sm:text-xs ${
                              emergency.status === 'active' 
                                ? 'bg-red-50 text-red-700 border-red-200' 
                                : emergency.status === 'responding'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-green-50 text-green-700 border-green-200'
                            }`}
                          >
                            {emergency.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-[10px] sm:text-xs text-muted-foreground text-right whitespace-nowrap">
                        {formatDistanceToNow(new Date(emergency.created_at), { addSuffix: true }).replace('about ', '')}
                      </div>
                      {(Date.now() - new Date(emergency.created_at).getTime()) < 5 * 60 * 1000 && (
                        <Badge className="bg-red-500 text-white text-[10px] sm:text-xs animate-pulse">NEW</Badge>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-foreground text-xs sm:text-sm bg-muted/30 p-2 sm:p-3 rounded-lg break-words">
                    {emergency.description}
                  </p>

                  {/* Photos */}
                  {emergency.photo_urls && emergency.photo_urls.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {emergency.photo_urls.map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Emergency photo ${index + 1}`}
                          className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                    {emergency.distance && (
                      <div className="flex items-center gap-1 shrink-0">
                        <MapPin className="h-3 w-3 text-blue-500" />
                        <span className="whitespace-nowrap">{emergency.distance} km</span>
                      </div>
                    )}
                    {emergency.location_address && (
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
                        <span className="truncate">{emergency.location_address}</span>
                      </div>
                    )}
                    {emergency.helper_count > 0 && (
                      <div className="flex items-center gap-1 text-green-600 font-medium shrink-0">
                        <Users className="h-3 w-3" />
                        <span className="whitespace-nowrap">{emergency.helper_count} helping</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {isAlertCreator(emergency) ? (
                    <div className="space-y-2">
                      <Button 
                        size="sm" 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white min-h-[44px] text-xs sm:text-sm animate-pulse"
                        onClick={() => {
                          setSelectedAlert(emergency);
                          setSelectedAlertId(emergency.id);
                          setShowHelperTracking(true);
                        }}
                      >
                        <Map className="h-4 w-4 mr-1" />
                        Track Helpers (Real-time)
                      </Button>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 min-h-[44px] text-xs sm:text-sm"
                          onClick={() => {
                            setSelectedAlert(emergency);
                            setShowEditAlert(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Alert
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 min-h-[44px] text-xs sm:text-sm"
                          onClick={() => handleResolveAlert(emergency.id)}
                          disabled={updateAlertStatus.isPending}
                        >
                          {updateAlertStatus.isPending ? (
                            <SerkleLoader size="xs" className="text-white mr-1" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Resolve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-red-600 hover:text-red-700 min-h-[44px] min-w-[44px]"
                          onClick={() => handleCancelAlert(emergency.id)}
                          disabled={updateAlertStatus.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {userResponses.has(emergency.id) ? (
                        <Button 
                          size="sm" 
                          className="flex-[1_1_100%] sm:flex-1 bg-green-100 text-green-700 border-green-300 cursor-not-allowed min-h-[44px] text-xs sm:text-sm"
                          disabled
                        >
                          ✓ Responding
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          className="flex-[1_1_100%] sm:flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 min-h-[44px] text-xs sm:text-sm"
                          onClick={() => handleRespond(emergency.id)}
                          disabled={respondToAlert.isPending || !latitude || !longitude}
                        >
                          {respondToAlert.isPending ? (
                            <SerkleLoader size="xs" className="text-white mr-1" />
                          ) : (
                            <Users className="h-4 w-4 mr-1" />
                          )}
                          I can help
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 min-w-[calc(50%-0.25rem)] min-h-[44px] text-xs sm:text-sm"
                        onClick={() => handleNavigate(emergency.location_lat, emergency.location_lng)}
                      >
                        <Navigation className="h-4 w-4 mr-1" />
                        <span className="hidden xs:inline">Navigate</span>
                        <span className="xs:hidden">Nav</span>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => {
                          setSelectedAlertId(emergency.id);
                          setShowMessaging(true);
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-red-600 min-h-[44px] min-w-[44px]"
                        onClick={() => {
                          setSelectedAlert(emergency);
                          setShowAbuseReport(true);
                        }}
                      >
                        <Flag className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
              ))}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={page === totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Messaging Dialog */}
      {selectedAlertId && (
        <SOSMessaging
          alertId={selectedAlertId}
          isOpen={showMessaging}
          onClose={() => setShowMessaging(false)}
        />
      )}

      {/* Abuse Report Modal */}
      {selectedAlert && (
        <AbuseReportModal
          isOpen={showAbuseReport}
          onClose={() => {
            setShowAbuseReport(false);
            setSelectedAlert(null);
          }}
          alertId={selectedAlert.id}
          reportedUserId={selectedAlert.user_id}
        />
      )}

      {/* Edit Alert Modal */}
      {selectedAlert && (
        <EditAlertModal
          isOpen={showEditAlert}
          onClose={() => {
            setShowEditAlert(false);
            setSelectedAlert(null);
          }}
          alertId={selectedAlert.id}
          currentDescription={selectedAlert.description}
          currentUrgency={selectedAlert.urgency}
        />
      )}

      {/* Helper Tracking Modal */}
      {selectedAlert && (
        <HelperTrackingModal
          isOpen={showHelperTracking}
          onClose={() => {
            setShowHelperTracking(false);
            setSelectedAlert(null);
            setSelectedAlertId(null);
          }}
          alertId={selectedAlert.id}
          alertLat={selectedAlert.location_lat}
          alertLng={selectedAlert.location_lng}
          helpers={availableHelpers || []}
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
