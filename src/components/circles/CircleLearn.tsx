import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CircleVideos from './CircleVideos';
import CircleResources from './CircleResources';
import { normalizeFeatures } from '@/lib/circleTypes';
import { type Circle } from '@/hooks/useCircles';

export type CircleLearnSection = 'videos' | 'resources';

interface CircleLearnProps {
  circle: Circle;
  isOwner: boolean;
  section: CircleLearnSection | null;
  onSectionChange: (section: CircleLearnSection) => void;
}

/**
 * The public "Learn" section: educational content grouped into Videos and
 * Resources sub-tabs. Only the sub-sections the circle has enabled are shown;
 * with a single one enabled the sub-tab bar is skipped entirely.
 */
const CircleLearn: React.FC<CircleLearnProps> = ({ circle, isOwner, section, onSectionChange }) => {
  const enabled = normalizeFeatures(circle.enabled_features);
  const hasVideos = enabled.includes('videos');
  const hasResources = enabled.includes('resources');

  if (hasVideos && !hasResources) return <CircleVideos circle={circle} isOwner={isOwner} />;
  if (hasResources && !hasVideos) return <CircleResources circle={circle} isOwner={isOwner} />;

  return (
    <Tabs
      value={section ?? 'videos'}
      onValueChange={(value) => {
        if (value === 'videos' || value === 'resources') onSectionChange(value);
      }}
      className="w-full"
    >
      <div className="px-4 pt-4">
        <TabsList className="grid grid-cols-2 h-9 w-full">
          <TabsTrigger value="videos" className="text-xs px-1">Videos</TabsTrigger>
          <TabsTrigger value="resources" className="text-xs px-1">Resources</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="videos" className="animate-fade-in">
        <CircleVideos circle={circle} isOwner={isOwner} />
      </TabsContent>
      <TabsContent value="resources" className="animate-fade-in">
        <CircleResources circle={circle} isOwner={isOwner} />
      </TabsContent>
    </Tabs>
  );
};

export default CircleLearn;
