import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Story } from '@/types/storyTypes';
import { storyService } from '@/services/storyService';
import { useUser } from './UserContext';

interface StoryContextType {
  stories: Story[];
  isLoading: boolean;
  refreshStories: () => Promise<void>;
  markStoryViewed: (storyId: string, shouldBroadcast?: boolean) => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export const StoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchVersion = useRef(0);
  const hasLoadedOnce = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // BUG-4 FIX: Use ref for debounce timer to prevent closure leak
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchStories = useCallback(async (silent = false) => {
    if (!user) {
      setStories([]);
      setIsLoading(false);
      return;
    }

    // BUG-4 FIX: Clear previous timer via ref
    clearTimeout(debounceTimer.current);
    return new Promise<void>((resolve) => {
      debounceTimer.current = setTimeout(async () => {
        const version = ++fetchVersion.current;
        if (!silent && !hasLoadedOnce.current) setIsLoading(true);

        try {
          // PERF-2 FIX: Delegating to storyService for fetching
          const { rawStories, viewedSet, storyMentions } = await storyService.fetchActiveStories(user.id);
          
          if (rawStories.length === 0) {
            if (fetchVersion.current === version) {
              // Still show own story placeholder
              const grouped: Story[] = [];
              if (user) {
                grouped.push({
                  id: `own-placeholder-${user.id}`,
                  user: { 
                    id: user.id, 
                    name: user.name, 
                    initials: user.initials, 
                    avatar: user.avatar,
                    avatarColor: user.avatarColor || '#E08ED1' 
                  },
                  image: '',
                  isOwn: true,
                  isViewed: true,
                  createdAt: undefined,
                });
              }
              setStories(grouped);
              setIsLoading(false);
              hasLoadedOnce.current = true;
            }
            resolve();
            return;
          }

          const transformedStories: Story[] = rawStories.map(story => 
            storyService.formatStory(story, viewedSet, storyMentions, user.id)
          );

          if (fetchVersion.current !== version) {
            resolve();
            return;
          }

          // Grouping and Sorting
          const userStoriesMap = new Map<string, Story[]>();
          const ownStories: Story[] = [];

          transformedStories.forEach(s => {
            if (s.isOwn) ownStories.push(s);
            else {
              const uid = s.user.id;
              if (!userStoriesMap.has(uid)) userStoriesMap.set(uid, []);
              userStoriesMap.get(uid)?.push(s);
            }
          });

          // Sort each user's stories oldest → newest so viewer plays chronologically
          const sortAsc = (a: Story, b: Story) => 
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          ownStories.sort(sortAsc);
          userStoriesMap.forEach(arr => arr.sort(sortAsc));

          const grouped: Story[] = [];
          if (user) {
            // BUG-10 FIX: Use unique placeholder ID instead of -1
            grouped.push({
              id: ownStories.length > 0 ? ownStories[0].id : `own-placeholder-${user.id}`,
              user: { 
                id: user.id, 
                name: user.name, 
                initials: user.initials, 
                avatar: user.avatar,
                avatarColor: user.avatarColor || '#E08ED1' 
              },
              image: ownStories.length > 0 ? ownStories[0].image : '',
              isOwn: true,
              isViewed: ownStories.length > 0 ? ownStories.every(s => s.isViewed) : true,
              allStories: ownStories.length > 0 ? ownStories : undefined,
              createdAt: ownStories.length > 0 ? ownStories[0].createdAt : undefined,
            });
          }

          const sortedPeers = Array.from(userStoriesMap.values()).sort((a, b) => {
            const aV = a.every(s => s.isViewed);
            const bV = b.every(s => s.isViewed);
            if (aV !== bV) return aV ? 1 : -1;
            return Math.max(...b.map(s => new Date(s.createdAt || 0).getTime())) - 
                   Math.max(...a.map(s => new Date(s.createdAt || 0).getTime()));
          });

          sortedPeers.forEach(peerStories => {
            grouped.push({
              ...peerStories[0],
              isViewed: peerStories.every(s => s.isViewed),
              allStories: peerStories,
            });
          });

          setStories(grouped);
        } catch (err) {
          console.error('[StoryProvider] Fetch error:', err);
        } finally {
          if (fetchVersion.current === version) {
            setIsLoading(false);
            hasLoadedOnce.current = true;
          }
          resolve();
        }
      }, silent ? 0 : 300);
    });
  }, [user]);

  // BUG-4 FIX: Clean up debounce timer on unmount or user change
  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, [user]);

  const markStoryViewed = useCallback((storyId: string, shouldBroadcast = true) => {
    setStories(prev => prev.map(group => {
      if (String(group.id) === String(storyId)) return { ...group, isViewed: true };
      if (group.allStories) {
        const has = group.allStories.some(s => String(s.id) === String(storyId));
        if (has) {
          const updated = group.allStories.map(s => String(s.id) === String(storyId) ? { ...s, isViewed: true } : s);
          return { ...group, isViewed: updated.every(s => s.isViewed), allStories: updated };
        }
      }
      return group;
    }));

    if (shouldBroadcast && channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'story_viewed', payload: { storyId } });
    }
  }, []);

  // Hydration and Realtime
  useEffect(() => {
    fetchStories();

    if (!user?.id) return;

    const channel = supabase
      .channel(`user-story-state-${user.id}`)
      .on('broadcast', { event: 'story_viewed' }, ({ payload }) => {
        if (payload?.storyId) markStoryViewed(payload.storyId, false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => fetchStories(true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams' }, ({ new: n }: any) => {
          if (n.status === 'ended') fetchStories(true);
      })
      .subscribe();

    channelRef.current = channel;

    return () => { channel.unsubscribe(); };
  }, [user?.id, fetchStories, markStoryViewed]);

  const value = useMemo(() => ({
    stories,
    isLoading,
    refreshStories: () => fetchStories(),
    markStoryViewed,
  }), [stories, isLoading, fetchStories, markStoryViewed]);

  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
};

export const useStoryContext = () => {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStoryContext must be used within a StoryProvider');
  }
  return context;
};
