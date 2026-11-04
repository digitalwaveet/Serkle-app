import React from 'react';
import { cn } from '@/lib/utils';

export const PremiumContentSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse select-none" aria-hidden="true">
      {/* Skeleton Block 1 */}
      <div className="space-y-3">
        <div className="h-4 bg-muted/40 rounded-full w-full" />
        <div className="h-4 bg-muted/30 rounded-full w-[95%]" />
        <div className="h-4 bg-muted/20 rounded-full w-[90%]" />
        <div className="h-4 bg-muted/30 rounded-full w-[85%]" />
      </div>
      
      {/* Skeleton Block 2 */}
      <div className="space-y-3">
        <div className="h-4 bg-muted/30 rounded-full w-full" />
        <div className="h-4 bg-muted/40 rounded-full w-[92%]" />
        <div className="h-4 bg-muted/20 rounded-full w-[88%]" />
        <div className="h-4 bg-muted/30 rounded-full w-3/4" />
      </div>

      {/* Skeleton Block 3 */}
      <div className="space-y-3">
        <div className="h-4 bg-muted/20 rounded-full w-[98%]" />
        <div className="h-4 bg-muted/30 rounded-full w-[94%]" />
        <div className="h-4 bg-muted/40 rounded-full w-[90%]" />
      </div>

      {/* Decorative High-Intensity Mesh Overlays */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50">
        <div className="absolute top-1/4 -left-1/4 w-full h-full bg-primary/10 blur-[100px] rounded-full rotate-12" />
        <div className="absolute bottom-1/4 -right-1/4 w-full h-full bg-secondary/10 blur-[100px] rounded-full -rotate-12" />
      </div>
    </div>
  );
};
