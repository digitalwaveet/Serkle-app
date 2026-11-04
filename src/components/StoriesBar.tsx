import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Story } from '@/types/storyTypes';
import StoryViewer from './StoryViewer';
import CreateStoryModal from './CreateStoryModal';
import WebRTCLiveViewer from './live/WebRTCLiveViewer';
import { useUser } from '@/contexts/UserContext';
import { useStoryPersistence } from '@/hooks/useStoryPersistence';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigation } from '@/contexts/NavigationContext';
import { StoryErrorBoundary } from './story/StoryErrorBoundary';

const StoriesBar: React.FC = () => {
  const { user, isLoading: authLoading } = useUser();
  const { pushModalState } = useNavigation();
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isLiveViewerOpen, setIsLiveViewerOpen] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [selectedLiveStreamId, setSelectedLiveStreamId] = useState<string | null>(null);
  const [stories, refreshStories, isLoading, markStoryViewed] = useStoryPersistence();

  const handleStoryClick = (story: Story, index: number) => {
    if (story.isLive && story.liveStreamId) {
      setSelectedLiveStreamId(story.liveStreamId);
      setIsLiveViewerOpen(true);
      pushModalState('live-viewer', () => {
        setIsLiveViewerOpen(false);
        setSelectedLiveStreamId(null);
      });
      return;
    }
    if (story.isOwn && (!story.allStories || story.allStories.length === 0)) {
      setIsCreateStoryOpen(true);
      pushModalState('create-story', () => setIsCreateStoryOpen(false));
      return;
    }
    setSelectedStoryIndex(index);
    setIsStoryViewerOpen(true);
    pushModalState('story-viewer', () => setIsStoryViewerOpen(false));
  };

  const handleCreateStory = () => {
    refreshStories();
  };

  const getFirstName = (name: string) => name.split(' ')[0];

  // Keep already-fetched stories visible during background refreshes.
  const showLoading = (authLoading || isLoading) && stories.length === 0;

  return (
    <>
      <section aria-label="Stories" className="px-4 py-3">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide" aria-live="polite">
          {showLoading && (
            <div className="flex min-h-24 w-full items-center justify-center py-8">
              <SerkleLoader size="sm" label="Loading stories" />
            </div>
          )}
          {!showLoading && stories.map((story, index) => {
            const isOwn = story.isOwn;
            const hasStories = story.allStories && story.allStories.length > 0;
            const isLive = story.isLive;
            const isViewed = story.isViewed;

            return (
              <div
                key={story.id}
                role="button"
                tabIndex={0}
                onClick={() => handleStoryClick(story, index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStoryClick(story, index);
                  }
                }}
                className="flex flex-col items-center shrink-0 gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl transition-transform hover:scale-105 cursor-pointer"
                aria-label={isOwn && !hasStories ? "Add your story" : `View ${story.user.name}'s story`}
              >
                <div className="relative">
                  {isOwn && !hasStories ? (
                    <>
                      {/* Own story — dashed border */}
                      <div className="size-[66px] rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center bg-background">
                        <Avatar className="size-14">
                          <AvatarImage src={user?.avatar} alt={user?.name} />
                          <AvatarFallback
                            className="text-xs font-medium text-white"
                            style={{ backgroundColor: user?.avatarColor || '#E08ED1' }}
                          >
                            {user?.initials || 'YS'}
                          </AvatarFallback>
                        </Avatar>
                        {/* Plus badge */}
                        <div
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsCreateStoryOpen(true); 
                            pushModalState('create-story', () => setIsCreateStoryOpen(false));
                          }}
                          className="absolute bottom-0 right-0 size-5 bg-primary rounded-full flex items-center justify-center border-2 border-background cursor-pointer"
                          role="button"
                          tabIndex={0}
                          aria-label="Add story"
                        >
                          <Plus className="size-3 text-white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Other stories — segmented gradient ring */
                    <div className="relative">
                      <svg className="size-[66px]" viewBox="0 0 66 66">
                        {(() => {
                          const storyCount = story.allStories?.length || 1;
                          const radius = 31;
                          const cx = 33;
                          const cy = 33;
                          const strokeWidth = 2.5;
                          const gapAngle = storyCount > 1 ? 8 : 0; // degrees gap between segments
                          const totalGap = gapAngle * storyCount;
                          const segmentAngle = (360 - totalGap) / storyCount;
                          
                          const circumference = 2 * Math.PI * radius;
                          
                          return Array.from({ length: storyCount }).map((_, i) => {
                            const startAngle = i * (segmentAngle + gapAngle) - 90;
                            const segmentLength = (segmentAngle / 360) * circumference;
                            const dashOffset = -((startAngle + 90) / 360) * circumference;
                            
                            return (
                              <circle
                                key={i}
                                cx={cx}
                                cy={cy}
                                r={radius}
                                fill="none"
                                stroke={isLive ? '#ef4444' : (() => {
                                  // Per-segment colour: grey if that specific story is viewed
                                  const segStory = story.allStories?.[i];
                                  const segViewed = segStory?.isViewed || isViewed;
                                  return segViewed ? '#9ca3af' : `url(#storyGradient-${story.id})`;
                                })()}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                                strokeDashoffset={dashOffset}
                                strokeLinecap="round"
                                className={isLive ? 'animate-pulse' : ''}
                              />
                            );
                          });
                        })()}
                        <defs>
                          <linearGradient id={`storyGradient-${story.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="hsl(var(--primary))" />
                            <stop offset="50%" stopColor="hsl(var(--secondary))" />
                            <stop offset="100%" stopColor="#f59e0b" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-background p-[2px] rounded-full">
                          <Avatar className="size-14">
                            <AvatarImage src={story.user.avatar} alt={story.user.name} />
                            <AvatarFallback
                              className="text-xs font-medium text-white"
                              style={{ backgroundColor: story.user.avatarColor }}
                            >
                              {story.user.initials}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LIVE badge */}
                  {isLive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap border border-background">
                      LIVE
                    </div>
                  )}

                  {/* Plus for own story with existing stories */}
                  {isOwn && hasStories && !isLive && (
                    <div
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setIsCreateStoryOpen(true); 
                        pushModalState('create-story', () => setIsCreateStoryOpen(false));
                      }}
                      className="absolute bottom-0 right-0 size-5 bg-primary rounded-full flex items-center justify-center border-2 border-background cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label="Add story"
                    >
                      <Plus className="size-3 text-white" />
                    </div>
                  )}
                </div>

                <span className="text-[11px] font-medium text-muted-foreground max-w-[64px] truncate text-center leading-tight">
                  {isOwn && isLive ? "LIVE" : isOwn ? (hasStories ? "Your Nest" : "Add story") : getFirstName(story.user.name)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {(() => {
        const allUserStories = stories
          .filter(s => s.allStories && s.allStories.length > 0)
          .flatMap(s => s.allStories!);
        
        // Find the index of the first story of the selected user group in the flattened array
        let initialFlatIndex = 0;
        if (selectedStoryIndex >= 0 && stories[selectedStoryIndex]) {
          const selectedUserId = stories[selectedStoryIndex].user.id;
          initialFlatIndex = allUserStories.findIndex(s => s.user.id === selectedUserId);
          if (initialFlatIndex === -1) initialFlatIndex = 0;
        }

        return (
          <StoryErrorBoundary>
            <StoryViewer
              stories={allUserStories}
              initialIndex={initialFlatIndex}
              isOpen={isStoryViewerOpen}
              onClose={() => setIsStoryViewerOpen(false)}
              onStoryViewed={markStoryViewed}
            />
          </StoryErrorBoundary>
        );
      })()}

      <CreateStoryModal
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        onCreateStory={handleCreateStory}
      />

      {isLiveViewerOpen && selectedLiveStreamId && (
        <WebRTCLiveViewer
          streamId={selectedLiveStreamId}
          onClose={() => {
            setIsLiveViewerOpen(false);
            setSelectedLiveStreamId(null);
          }}
        />
      )}
    </>
  );
};

export default StoriesBar;
