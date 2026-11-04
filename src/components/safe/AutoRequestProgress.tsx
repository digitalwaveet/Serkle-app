import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { X, User, Clock, MapPin } from 'lucide-react';

interface AutoRequestProgressProps {
  isRequesting: boolean;
  currentHelper: {
    user_id: string;
    profiles?: {
      name: string;
      avatar_url?: string;
      initials?: string;
      avatar_color?: string;
    };
  } | null;
  timeRemaining: number;
  totalElapsed: number;
  currentHelperIndex: number;
  totalHelpers: number;
  onCancel: () => void;
}

export const AutoRequestProgress: React.FC<AutoRequestProgressProps> = ({
  isRequesting,
  currentHelper,
  timeRemaining,
  totalElapsed,
  currentHelperIndex,
  totalHelpers,
  onCancel,
}) => {
  if (!isRequesting || !currentHelper) return null;

  const profile = currentHelper.profiles;
  const progressPercentage = (timeRemaining / 30) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <Card className="max-w-md w-full p-6 border-2 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)]">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SerkleLoader size="xs" className="text-blue-500" />
              <h3 className="font-bold text-lg">Finding Helper...</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Current Helper */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Avatar className="h-16 w-16 border-2 border-blue-500">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback style={{ backgroundColor: profile?.avatar_color || '#3b82f6' }}>
                {profile?.initials || 'H'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-lg">
                {profile?.name || 'Helper'}
              </p>
              <p className="text-sm text-muted-foreground">
                Waiting for response...
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{timeRemaining}s left</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>
                    Helper {currentHelperIndex}/{totalHelpers}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Response timer</span>
              <span className="font-mono font-bold text-blue-600">
                {timeRemaining}s
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Total Elapsed Time */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Total search time
              </span>
            </div>
            <span className="font-mono font-semibold">
              {Math.floor(totalElapsed / 60)}:{String(totalElapsed % 60).padStart(2, '0')}
            </span>
          </div>

          {/* Info Text */}
          <div className="text-xs text-center text-muted-foreground">
            {timeRemaining <= 10 && (
              <p className="text-orange-600 font-medium animate-pulse">
                Moving to next helper soon...
              </p>
            )}
            <p className="mt-1">
              We'll automatically try the next nearest helper if this one doesn't respond
            </p>
          </div>

          {/* Cancel Button */}
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full"
          >
            Cancel Search
          </Button>
        </div>
      </Card>

      <style>{`
        @keyframes pulse-shadow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 40px rgba(59, 130, 246, 0.8);
          }
        }
      `}</style>
    </div>
  );
};
