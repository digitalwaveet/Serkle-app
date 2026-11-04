import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { MapPin, Eye, EyeOff, Shield, Info } from 'lucide-react';

interface LocationPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (radius: number) => void;
  currentRadius?: number;
}

export const LocationPrivacyModal: React.FC<LocationPrivacyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentRadius = 5
}) => {
  const [radius, setRadius] = useState(currentRadius);

  const handleSave = () => {
    onSave(radius);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Location Privacy Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Privacy Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm text-blue-900">
                <p className="font-medium">How your location is shared:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Only helpers within your selected radius can see your alerts</li>
                  <li>Your exact location is only shared with responding helpers</li>
                  <li>Location data is encrypted and never sold to third parties</li>
                  <li>You can stop sharing your location at any time</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Radius Selector */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Alert Radius</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Helpers within this distance will be notified of your emergency
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{radius} km radius</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  ~{Math.round(Math.PI * radius * radius)} km² area
                </span>
              </div>

              <Slider
                value={[radius]}
                onValueChange={(value) => setRadius(value[0])}
                min={1}
                max={20}
                step={1}
                className="w-full"
              />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 km (Very close)</span>
                <span>20 km (Wide area)</span>
              </div>
            </div>

            {/* Visual Indicator */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div 
                    className="rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center transition-all"
                    style={{ 
                      width: `${Math.min(radius * 8, 160)}px`, 
                      height: `${Math.min(radius * 8, 160)}px` 
                    }}
                  >
                    <div className="h-4 w-4 bg-blue-600 rounded-full border-2 border-white" />
                  </div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="text-xs text-blue-600 font-medium mt-8">
                      {radius} km
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Who Can See */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Who can see your location:
            </h4>
            <div className="space-y-2 text-sm text-foreground">
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-green-600" />
                </div>
                <span>Active helpers within {radius} km who accept your alert</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                </div>
                <span>Emergency contacts you've designated</span>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <EyeOff className="h-4 w-4" />
              Who cannot see your location:
            </h4>
            <div className="space-y-2 text-sm text-foreground">
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <X className="h-3 w-3 text-red-600" />
                </div>
                <span>Inactive helpers or those outside your radius</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <X className="h-3 w-3 text-red-600" />
                </div>
                <span>Anyone who hasn't accepted your SOS alert</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <X className="h-3 w-3 text-red-600" />
                </div>
                <span>Third-party advertisers or data brokers</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function X({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M6 18L18 6M6 6l12 12" 
      />
    </svg>
  );
}
