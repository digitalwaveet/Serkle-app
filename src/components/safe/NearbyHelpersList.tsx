import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, MapPin, Star, Phone, CheckCircle, Clock } from 'lucide-react';
import { useHelperRequests } from '@/hooks/useHelperRequests';
import { formatDistanceToNow } from 'date-fns';

interface NearbyHelpersListProps {
  helpers: any[];
  alertId: string;
  userLat?: number | null;
  userLng?: number | null;
}

export const NearbyHelpersList: React.FC<NearbyHelpersListProps> = ({
  helpers,
  alertId,
  userLat,
  userLng,
}) => {
  const { sendRequest, sentRequests } = useHelperRequests(alertId);
  const [requestingHelperId, setRequestingHelperId] = useState<string | null>(null);

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
    const distance = R * c;
    
    return Math.round(distance * 10) / 10;
  };

  const toRad = (degrees: number) => degrees * (Math.PI / 180);

  const getHelperStatus = (helperId: string) => {
    return sentRequests?.find(req => req.helper_id === helperId);
  };

  const handleRequestHelper = async (helperId: string) => {
    setRequestingHelperId(helperId);
    try {
      await sendRequest.mutateAsync({
        alertId,
        helperId,
        message: 'I need your help urgently!',
      });
    } finally {
      setRequestingHelperId(null);
    }
  };

  if (helpers.length === 0) {
    return (
      <Card className="p-6 text-center">
        <User className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No helpers available nearby</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <User className="h-4 w-4" />
          Available Helpers ({helpers.length})
        </h3>
      </div>

      {helpers.map((helper: any) => {
        const profile = helper.profiles;
        const distance = userLat && userLng && helper.location_lat && helper.location_lng
          ? calculateDistance(userLat, userLng, helper.location_lat, helper.location_lng)
          : null;
        
        const request = getHelperStatus(helper.user_id);
        const isPending = request?.status === 'pending';
        const isAccepted = request?.status === 'accepted';
        const isDeclined = request?.status === 'declined';

        return (
          <Card key={helper.user_id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback style={{ backgroundColor: profile?.avatar_color }}>
                  {profile?.initials || 'H'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm truncate">
                      {profile?.name || 'Helper'}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                        {helper.availability_status || 'Available'}
                      </Badge>
                      {helper.helper_badge && (
                        <Badge variant="secondary" className="text-xs">
                          {helper.helper_badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {distance && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{distance} km</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>{helper.average_rating?.toFixed(1) || '5.0'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    <span>{helper.completion_count || 0} helped</span>
                  </div>
                  {helper.average_response_time_minutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>~{helper.average_response_time_minutes}m</span>
                    </div>
                  )}
                </div>

                {/* Skills */}
                {helper.skills && helper.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {helper.skills.slice(0, 3).map((skill: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Action Button */}
                <div className="mt-3">
                  {isAccepted ? (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Helper accepted! On the way</span>
                    </div>
                  ) : isPending ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled className="flex-1">
                        <Clock className="h-4 w-4 mr-1" />
                        Request Sent
                      </Button>
                    </div>
                  ) : isDeclined ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      className="w-full text-muted-foreground"
                    >
                      Declined
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleRequestHelper(helper.user_id)}
                      disabled={requestingHelperId === helper.user_id || sendRequest.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      {requestingHelperId === helper.user_id ? 'Requesting...' : 'Request Help'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
