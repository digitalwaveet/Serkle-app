import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface LocationDisplayProps {
  location: string;
  className?: string;
}

/** Extract a concise "City, Country/Region" label from a longer address. */
const conciseLocation = (location: string): string => {
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return location;
  // Take the last two meaningful segments (typically City, Country/State)
  return parts.slice(-2).join(', ');
};

/**
 * One-line location with tap-to-view full address for long addresses.
 */
const LocationDisplay: React.FC<LocationDisplayProps> = ({ location, className = '' }) => {
  const [showFull, setShowFull] = useState(false);
  const concise = conciseLocation(location);
  const isLong = concise !== location || location.length > 40;

  if (!isLong) {
    return (
      <div className={`flex items-center gap-1.5 text-muted-foreground ${className}`}>
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{location}</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowFull(true)}
        className={`flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-left ${className}`}
      >
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{concise}</span>
      </button>

      <Dialog open={showFull} onOpenChange={setShowFull}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground leading-relaxed">{location}</p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LocationDisplay;
