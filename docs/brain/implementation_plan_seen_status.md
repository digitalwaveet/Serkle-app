# Persistent Story Seen Status

Implement persistent tracking of which stories a user has seen, visually represented by the color of the story ring (gradient for new, grey for seen).

## Proposed Changes

### [Component] [Stories]

#### [MODIFY] [useStoryPersistence.tsx](file:///c:/Users/elink/./heart-lens-studio-main/src/hooks/useStoryPersistence.tsx)
- Update `fetchStories` to also fetch `story_views` for the current user.
- Mark individual stories as `isViewed: true` if an entry exists in `story_views`.
- Calculate `isViewed` for the grouped story circles (authors) based on whether *all* their active stories have been seen.

#### [MODIFY] [StoryViewer.tsx](file:///c:/Users/elink/./heart-lens-studio-main/src/components/StoryViewer.tsx)
- Add a mechanism to record a view in the `story_views` table when a story is shown.
- Ensure this happens when a story is first displayed and when transitioning to a new one.

#### [MODIFY] [StoriesBar.tsx](file:///c:/Users/elink/./heart-lens-studio-main/src/components/StoriesBar.tsx)
- Ensure the `isViewed` property from `useStoryPersistence` is correctly passed and used to determine the ring color (`#9ca3af` for seen, gradient for unseen).

## Verification Plan

### Automated/Manual Verification
1. **Initial State**: New stories should have a gradient ring.
2. **Viewing**: Open a user's stories and watch them all.
3. **Outcome**: Close the viewer; the user's ring should now be grey.
4. **New Content**: If that user posts a new story (can be simulated by adding a record to the `stories` table), their ring should return to gradient.
5. **Persistence**: Refresh the page; the seen statuses should persist.
