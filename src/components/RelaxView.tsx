import React from 'react';
import { RelaxVideoPlayer } from './RelaxVideoPlayer';
import { type TabKey } from '@/hooks/useAppNav';

interface RelaxViewProps {
  autoOpenFirstVideo?: boolean;
  initialVideoId?: string;
  initialOpenComments?: boolean;
  onBackToFeed?: () => void;
  activeTab?: TabKey;
  onTabSelect?: (key: TabKey) => void;
  onOpenCreate?: () => void;
  onRefresh?: () => void;
}

export const RelaxView: React.FC<RelaxViewProps> = ({ 
  onBackToFeed,
  onRefresh,
  activeTab,
  onTabSelect,
  onOpenCreate,
  initialVideoId,
  initialOpenComments
}) => {
  return (
    <RelaxVideoPlayer 
      onBackToFeed={onBackToFeed}
      onRefresh={onRefresh}
      activeTab={activeTab}
      onTabSelect={onTabSelect}
      onOpenCreate={onOpenCreate}
      initialVideoId={initialVideoId}
      initialOpenComments={initialOpenComments}
    />
  );
};