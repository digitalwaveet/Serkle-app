import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { lazy, Suspense } from 'react';

import { Card } from '@/components/ui/card';

// Lazy load the map component for better performance
const SOSMapInteractive = lazy(() => 
  import('./SOSMapInteractive').then(module => ({ default: module.SOSMapInteractive }))
);

interface LazyMapProps {
  userLat?: number | null;
  userLng?: number | null;
}

const MapLoadingFallback = () => (
  <Card className="relative h-[400px] sm:h-[500px] flex items-center justify-center bg-muted">
    <div className="flex flex-col items-center gap-3">
      <SerkleLoader size="md" className="text-primary" />
      <p className="text-sm text-muted-foreground">Loading map...</p>
    </div>
  </Card>
);

export const LazyMap: React.FC<LazyMapProps> = ({ userLat, userLng }) => {
  return (
    <Suspense fallback={<MapLoadingFallback />}>
      <SOSMapInteractive userLat={userLat} userLng={userLng} />
    </Suspense>
  );
};
