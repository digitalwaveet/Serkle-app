import React from 'react';
import { SerkleLoader } from './SerkleLoader';

// Keep region-level placeholders, with a single animation instead of many shimmer bars.
export const PostCardSkeleton = () => (
  <div className="min-h-64 mb-4 rounded-2xl border border-border bg-card flex items-center justify-center">
    <SerkleLoader label="Loading posts" showText />
  </div>
);
export const VideoCardSkeleton = () => (
  <div className="min-h-72 mb-4 rounded-2xl border border-border bg-card flex items-center justify-center">
    <SerkleLoader label="Loading videos" showText />
  </div>
);
export const ProfileHeaderSkeleton = () => (
  <div className="min-h-96 flex items-center justify-center bg-background">
    <SerkleLoader label="Loading profile" showText />
  </div>
);
export const TabContentSkeleton = ({ itemCount = 3 }: { itemCount?: number }) => (
  <div className="flex items-center justify-center py-16" style={{ minHeight: Math.min(itemCount, 3) * 100 }}>
    <SerkleLoader label="Loading content" showText />
  </div>
);
