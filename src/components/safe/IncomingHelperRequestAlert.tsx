import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Clock, AlertTriangle, Check, X } from 'lucide-react';
import { useHelperRequests } from '@/hooks/useHelperRequests';
import { formatDistanceToNow } from 'date-fns';

export const IncomingHelperRequestAlert: React.FC = () => {
  const { incomingRequests, respondToRequest } = useHelperRequests();
  const [showAlert, setShowAlert] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (incomingRequests && incomingRequests.length > 0) {
      setShowAlert(true);
      setIsAnimating(true);
      
      // Play sound notification
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi78OScSwgOR6Pm7rdgHAU7k9nywHwsBSt8zO/HeDQJE2K47u2WTBINV6fo8bFgFwU9lt7wwX4wBSp6y+7Kfj0MDluv7O+XUBAMUrHm77JlHgU9lt7wwH0yBSh5ye/Kfj0LDVyr7O+YUxEMUK7k7bBlHgU9ltfvwH0yBSh5ye/Kfj0LDVyr7O+YUhEMT6zj7bFlHgU9ld7vwH0yBSh5ye/Kfj0LDVyp7O+YUxEMT6zj7bFlHgU9lt7wwH0yBSh5ye/Kfj0LDVyp7O+YUhEMT6zj7bFlHgU9lt7wwH0yBSh5ye/Kfj0LDVyp7O+YUhEMT6zj7bFlHgU9lt7wwH0yBSh5ye/Kfj0LDVyp7O+YUhEMT6zj7bFlHgU9lt7wwH0yBSh5ye/Kfj0LDVyp7O+YUhEMT6zj7bFlHgU9lt7wwH0yBSh5ye/Kfj0LDVyp7O+YUhEMT6zj7bFlHgU9lt7wwH0yBSh5ye/Kfj0LDVyp7O+YUhEMT6zj7bFlHgU9lt7wwH0yBSh5ye/Kfj0LDVyp7O+YUhEMT6zj7bFlHg==');
      audio.play().catch(() => {});
      
      // Trigger vibration
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      // Stop animation after 3 seconds
      setTimeout(() => setIsAnimating(false), 3000);
    } else {
      setShowAlert(false);
    }
  }, [incomingRequests]);

  if (!showAlert || !incomingRequests || incomingRequests.length === 0) {
    return null;
  }

  const latestRequest = incomingRequests[0];
  const alert = latestRequest.sos_alerts;
  const requester = latestRequest.profiles;

  const getUrgencyColor = (urgency: string) => {
    const colors = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-blue-500',
    };
    return colors[urgency as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <Card 
        className={`max-w-md w-full p-6 border-4 ${isAnimating ? 'border-red-500 animate-pulse-border shadow-[0_0_50px_rgba(239,68,68,0.6)]' : 'border-red-500'}`}
      >
        {/* Red flash animation overlay */}
        {isAnimating && (
          <div className="absolute inset-0 bg-red-500/20 animate-flash rounded-lg pointer-events-none" />
        )}
        
        <div className="relative space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full animate-bounce">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-600">Help Request!</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(latestRequest.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <Badge className={`${getUrgencyColor(alert.urgency)} text-white animate-pulse`}>
              {alert.urgency}
            </Badge>
          </div>

          {/* Requester Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar className="h-12 w-12 border-2 border-white">
              <AvatarImage src={requester?.avatar_url || ''} />
              <AvatarFallback style={{ backgroundColor: requester?.avatar_color }}>
                {requester?.initials || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold">{requester?.name || 'Anonymous'}</p>
              <p className="text-sm text-muted-foreground">needs your help</p>
            </div>
          </div>

          {/* Alert Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-medium">{alert.sos_type}</span>
            </div>
            <p className="text-sm text-muted-foreground">{alert.description}</p>
            {alert.location_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-blue-500 mt-0.5" />
                <span className="text-muted-foreground">{alert.location_address}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                respondToRequest.mutate({
                  requestId: latestRequest.id,
                  status: 'declined',
                });
                setShowAlert(false);
              }}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Decline
            </Button>
            <Button
              onClick={() => {
                respondToRequest.mutate({
                  requestId: latestRequest.id,
                  status: 'accepted',
                  estimatedArrival: 5,
                });
                setShowAlert(false);
              }}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
              Accept & Go
            </Button>
          </div>

          {/* Additional requests counter */}
          {incomingRequests.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">
              +{incomingRequests.length - 1} more request{incomingRequests.length > 2 ? 's' : ''} waiting
            </p>
          )}
        </div>
      </Card>

      <style>{`
        @keyframes pulse-border {
          0%, 100% {
            box-shadow: 0 0 30px rgba(239, 68, 68, 0.6);
          }
          50% {
            box-shadow: 0 0 50px rgba(239, 68, 68, 0.9);
          }
        }
        
        @keyframes flash {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        
        .animate-pulse-border {
          animation: pulse-border 1.5s ease-in-out infinite;
        }
        
        .animate-flash {
          animation: flash 0.5s ease-in-out 3;
        }
      `}</style>
    </div>
  );
};
