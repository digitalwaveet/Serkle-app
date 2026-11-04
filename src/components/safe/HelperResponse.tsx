import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Clock, MessageCircle, Phone, Star, Navigation, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import { useHelperProfile } from '@/hooks/useHelperProfile';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSOSHelpers } from '@/hooks/useSOSHelpers';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { SOSMessaging } from './SOSMessaging';
import { HelperOnboarding } from './HelperOnboarding';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const HELPER_SKILLS = [
  'First Aid Certified',
  'CPR Certified',
  'Medical Professional',
  'Emergency Responder',
  'Local Guide',
  'Translator',
  'Vehicle Available',
  'Tools Available',
];

export const HelperResponse: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [showMessaging, setShowMessaging] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  
  const { latitude, longitude } = useGeolocation();
  const {
    helperProfile,
    activeResponses,
    completedResponses,
    updateAvailability,
    updateLocation,
    updateSkills,
  } = useHelperProfile(userId || undefined);
  
  const activeResponse = activeResponses[0];
  const { markAsArrived, completeHelp, cancelResponse } = useSOSHelpers(activeResponse?.alert_id || '');

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Debounce location updates to avoid excessive API calls
  useEffect(() => {
    if (!userId || !latitude || !longitude || !helperProfile?.is_available) return;
    
    const debounceTimer = setTimeout(() => {
      updateLocation.mutate({ lat: latitude, lng: longitude });
    }, 5000); // Update every 5 seconds at most
    
    return () => clearTimeout(debounceTimer);
  }, [latitude, longitude, userId, helperProfile?.is_available]);

  const toggleSkill = (skill: string) => {
    const currentSkills = helperProfile?.skills || [];
    const newSkills = currentSkills.includes(skill)
      ? currentSkills.filter(s => s !== skill)
      : [...currentSkills, skill];
    
    updateSkills.mutate(newSkills);
  };

  const handleAvailabilityChange = (status: 'available' | 'busy' | 'offline') => {
    updateAvailability.mutate({
      status,
      isAvailable: status === 'available',
    });
  };

  const getAvailabilityColor = (status: string) => {
    const colors = {
      available: 'bg-green-100 text-green-800 border-green-200',
      busy: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      offline: 'bg-muted/50 text-foreground border-border',
    };
    return colors[status as keyof typeof colors];
  };

  // Show onboarding if not a helper yet
  if (!helperProfile) {
    return (
      <div className="px-4 space-y-4">
        <Card className="p-8 text-center">
          <h3 className="text-lg font-medium mb-2">Become a Helper First</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Register as a helper to respond to emergencies and manage your responses
          </p>
          <Button onClick={() => setShowOnboarding(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Register as Helper
          </Button>
        </Card>
        <HelperOnboarding 
          open={showOnboarding} 
          onOpenChange={setShowOnboarding}
        />
      </div>
    );
  }

  return (
    <div className="px-4 space-y-6">
      {/* Helper Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Helper Status</h2>
          <Badge className={getAvailabilityColor(helperProfile?.availability_status || 'offline')}>
            {helperProfile?.availability_status || 'offline'}
          </Badge>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Availability Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['available', 'busy', 'offline'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleAvailabilityChange(status as any)}
                  disabled={updateAvailability.isPending}
                  className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                    helperProfile?.availability_status === status 
                      ? getAvailabilityColor(status)
                      : 'bg-card border-border text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Your Skills & Certifications
            </label>
            <div className="grid grid-cols-2 gap-2">
              {HELPER_SKILLS.map((skill) => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  disabled={updateSkills.isPending}
                  className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                    helperProfile?.skills?.includes(skill)
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-card border-border text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Active Response */}
      {activeResponses.length > 0 ? (
        activeResponses.map((response: any) => {
          const alert = response.sos_alerts;
          const requester = alert?.profiles;
          
          return (
            <Card key={response.id} className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-foreground">Currently Responding</h3>
                <Badge className="bg-blue-100 text-blue-800">
                  {response.status === 'arrived' ? 'Arrived' : 'En Route'}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={requester?.avatar_url} />
                    <AvatarFallback 
                      style={{ backgroundColor: requester?.avatar_color || '#3b82f6' }}
                      className="text-white"
                    >
                      {requester?.initials || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {requester?.full_name || 'Anonymous'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {alert?.sos_type} - {alert?.description?.substring(0, 50)}...
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {alert?.location_address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {alert.location_address}
                        </div>
                      )}
                      {response.estimated_arrival_minutes && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          ETA: {response.estimated_arrival_minutes} min
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setSelectedAlertId(alert.id);
                      setShowMessaging(true);
                    }}
                  >
                    <MessageCircle className="h-4 w-4 mr-1" />
                    Message
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      if (alert?.location_lat && alert?.location_lng) {
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${alert.location_lat},${alert.location_lng}`,
                          '_blank'
                        );
                      }
                    }}
                  >
                    <Navigation className="h-4 w-4 mr-1" />
                    Navigate
                  </Button>
                </div>

                {/* Status Progression Timeline */}
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <div className={`flex flex-col items-center gap-1 ${response.status === 'responding' || response.status === 'arrived' || response.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                      <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${response.status === 'responding' || response.status === 'arrived' || response.status === 'completed' ? 'border-green-600 bg-green-100' : 'border-border'}`}>
                        ✓
                      </div>
                      <span className="font-medium">Responded</span>
                    </div>
                    <div className={`flex-1 h-0.5 mx-2 ${response.status === 'arrived' || response.status === 'completed' ? 'bg-green-600' : 'bg-gray-300'}`} />
                    <div className={`flex flex-col items-center gap-1 ${response.status === 'arrived' || response.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                      <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${response.status === 'arrived' || response.status === 'completed' ? 'border-green-600 bg-green-100' : 'border-border'}`}>
                        {response.status === 'arrived' || response.status === 'completed' ? '✓' : '2'}
                      </div>
                      <span className="font-medium">Arrived</span>
                    </div>
                    <div className={`flex-1 h-0.5 mx-2 ${response.status === 'completed' ? 'bg-green-600' : 'bg-gray-300'}`} />
                    <div className={`flex flex-col items-center gap-1 ${response.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                      <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${response.status === 'completed' ? 'border-green-600 bg-green-100' : 'border-border'}`}>
                        {response.status === 'completed' ? '✓' : '3'}
                      </div>
                      <span className="font-medium">Completed</span>
                    </div>
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div className="flex gap-2 mt-2">
                  {response.status === 'responding' && (
                    <>
                      <Button 
                        size="sm" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        onClick={() => markAsArrived.mutate(
                          { helperId: response.id },
                          {
                            onSuccess: () => {
                              toast.success('Marked as arrived', { icon: '✓' });
                            },
                          }
                        )}
                        disabled={markAsArrived.isPending}
                      >
                        {markAsArrived.isPending ? (
                          <SerkleLoader size="xs" className="text-white mr-1" />
                        ) : (
                          <MapPin className="h-4 w-4 mr-1" />
                        )}
                        Mark as Arrived
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-red-600"
                        onClick={() => cancelResponse.mutate(
                          { helperId: response.id },
                          {
                            onSuccess: () => {
                              toast.success('Response cancelled', { icon: '✓' });
                            },
                          }
                        )}
                        disabled={cancelResponse.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {response.status === 'arrived' && (
                    <Button 
                      size="sm" 
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      onClick={() => completeHelp.mutate(
                        { 
                          alertId: response.alert_id, 
                          helperId: response.id 
                        },
                        {
                          onSuccess: () => {
                            toast.success('Help completed successfully', { icon: '✓' });
                          },
                        }
                      )}
                      disabled={completeHelp.isPending}
                    >
                      {completeHelp.isPending ? (
                        <SerkleLoader size="xs" className="text-white mr-1" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      Complete Help
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      ) : (
        <Card className="p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground text-center">
            No active responses. Check nearby alerts to offer help.
          </p>
        </Card>
      )}

      {/* Helper Stats */}
      <Card className="p-4">
        <h3 className="font-medium text-foreground mb-3">Your Helper Stats</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {helperProfile?.completion_count || 0}
            </div>
            <div className="text-xs text-muted-foreground">Helped</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-yellow-600">
                {helperProfile?.average_rating?.toFixed(1) || '0.0'}
              </span>
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
            </div>
            <div className="text-xs text-muted-foreground">Rating</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {helperProfile?.average_response_time_minutes || 0}
            </div>
            <div className="text-xs text-muted-foreground">Avg Response (min)</div>
          </div>
        </div>
      </Card>

      {/* Recent Responses */}
      <Card className="p-4">
        <h3 className="font-medium text-foreground mb-3">Recent Responses</h3>
        {completedResponses.length > 0 ? (
          <div className="space-y-3">
            {completedResponses.map((response: any) => {
              const alert = response.sos_alerts;
              const review = response.sos_reviews?.[0];
              
              return (
                <div key={response.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {alert?.sos_type || 'Emergency'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alert?.resolved_at ? formatDistanceToNow(new Date(alert.resolved_at), { addSuffix: true }) : 'Recently'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                      Completed
                    </Badge>
                    {review?.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                        <span className="text-xs text-muted-foreground">{review.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No completed responses yet</p>
        )}
      </Card>

      {/* Messaging Dialog */}
      {selectedAlertId && (
        <SOSMessaging
          alertId={selectedAlertId}
          isOpen={showMessaging}
          onClose={() => setShowMessaging(false)}
        />
      )}
    </div>
  );
};