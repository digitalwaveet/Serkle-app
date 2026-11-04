import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Clock, Users, MessageCircle, Navigation } from 'lucide-react';
import { useSOSAlerts } from '@/hooks/useSOSAlerts';
import { useGeolocation } from '@/hooks/useGeolocation';
import { formatDistanceToNow } from 'date-fns';

export const EmergencyFeed: React.FC = () => {
  const { latitude, longitude } = useGeolocation();
  const { alerts, isLoading, error } = useSOSAlerts(latitude, longitude);
  const getTypeColor = (type: string) => {
    const colors = {
      medical: 'bg-red-100 text-red-800 border-red-200',
      safety: 'bg-orange-100 text-orange-800 border-orange-200',
      fire: 'bg-red-100 text-red-800 border-red-200',
      accident: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      natural: 'bg-blue-100 text-blue-800 border-blue-200',
      other: 'bg-muted/50 text-foreground border-border',
    };
    return colors[type as keyof typeof colors] || colors.other;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-red-100 text-red-800',
      responding: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  if (isLoading) {
    return (
      <div className="px-4 py-12 flex items-center justify-center">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8">
        <Card className="p-6 text-center border-destructive">
          <p className="text-destructive font-medium mb-2">Failed to load emergencies</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </Card>
      </div>
    );
  }

  const activeAlerts = alerts?.filter(a => a.status === 'active' || a.status === 'responding') || [];

  return (
    <div className="px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active Emergencies</h2>
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          {activeAlerts.length} Active
        </Badge>
      </div>

      {activeAlerts.map((emergency) => (
        <Card key={emergency.id} className="p-4 border-l-4 border-l-red-500">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white text-sm font-semibold">
                  {emergency.profiles?.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                </div>
                <div>
                  <p className="font-medium">{emergency.profiles?.name || 'Anonymous'}</p>
                  <div className="flex items-center gap-2">
                    <Badge className={getTypeColor(emergency.sos_type)}>
                      {emergency.sos_type}
                    </Badge>
                    <Badge className={getStatusColor(emergency.status)}>
                      {emergency.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(emergency.created_at), { addSuffix: true })}
              </div>
            </div>

            <p className="text-sm">{emergency.description}</p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {emergency.distance ? `${emergency.distance.toFixed(1)}km away` : 'Unknown'}
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {emergency.helper_count || 0} helpers
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="flex-1"
                onClick={() => {
                  if (emergency.location_lat && emergency.location_lng) {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${emergency.location_lat},${emergency.location_lng}`,
                      '_blank'
                    );
                  }
                }}
              >
                <Navigation className="h-4 w-4 mr-1" />
                Navigate
              </Button>
            </div>

            {(emergency.helper_count || 0) > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                <div className="flex -space-x-1">
                  {[...Array(Math.min(emergency.helper_count || 0, 3))].map((_, i) => (
                    <Avatar key={i} className="h-6 w-6 border-2 border-white">
                      <AvatarFallback className="text-xs bg-green-100 text-green-800">
                        H{i + 1}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-xs text-green-800">
                  {emergency.helper_count} helper{emergency.helper_count !== 1 ? 's' : ''} responding
                </span>
              </div>
            )}
          </div>
        </Card>
      ))}

      {activeAlerts.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">No Active Emergencies</h3>
            <p className="text-sm">Your community is safe right now</p>
          </div>
        </Card>
      )}
    </div>
  );
};