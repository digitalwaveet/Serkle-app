import { useStoryContext } from '@/contexts/StoryContext';

/**
 * useStoryPersistence
 * Hook that consumes the global StoryContext.
 * Maintains compatibility with components like StoriesBar.
 */
export const useStoryPersistence = () => {
  const { stories, isLoading, refreshStories, markStoryViewed } = useStoryContext();

  // Maintain array return signature for backward compatibility
  return [stories, refreshStories, isLoading, markStoryViewed] as const;
};
