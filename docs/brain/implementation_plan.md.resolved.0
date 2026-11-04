# Implementation Plan - Circle Feed Video Tab

Add a YouTube-style landscape video experience to the Circle Feed, supporting playlists, monetization (paid access, gifts), and a custom video player.

## Proposed Changes

### Database Schema

#### [NEW] `20260318085500_circle_videos.sql`
Create a new migration file to:
- Create `video_playlists` table (id, circle_id, user_id, name, description, thumbnail_url, created_at).
- Create `circle_videos` table (id, circle_id, user_id, playlist_id, video_url, thumbnail_url, title, description, is_premium, price, duration, views_count, created_at).
- Create `video_unlocks` table (id, video_id, user_id, amount_paid, created_at).
- Add `video_id` column to `circle_tips` table.
- Enable RLS and setup policies for all new tables.

### Hooks & Logic

#### [MODIFY] [useCircleVideos.ts](file:///c:/Users/elink/scratch/MomNest/heart-lens-studio-main/src/hooks/useCircleVideos.ts)
- Refine existing draft to remove `as any` (if possible after migration) or ensure strict typing.
- Ensure it handles fetching by circle, uploading, and unlocking correctly.

#### [NEW] [useVideoPlaylists.ts](file:///c:/Users/elink/scratch/MomNest/heart-lens-studio-main/src/hooks/useVideoPlaylists.ts)
- Hook for fetching and managing playlists within a circle.

### UI Components

#### [NEW] [CircleVideoCard.tsx](file:///c:/Users/elink/scratch/MomNest/heart-lens-studio-main/src/components/circles/CircleVideoCard.tsx)
- Landscape card displaying thumbnail, duration, title, creator, and premium status (price).

#### [NEW] [CircleVideoPlayer.tsx](file:///c:/Users/elink/scratch/MomNest/heart-lens-studio-main/src/components/circles/CircleVideoPlayer.tsx)
- Landscape player with standard controls (play/pause, volume, fullscreen).
- Includes "Next" video autoplay logic for playlists.

#### [NEW] [CircleVideoComposer.tsx](file:///c:/Users/elink/scratch/MomNest/heart-lens-studio-main/src/components/circles/CircleVideoComposer.tsx)
- Upload modal for Circle Owners to add videos, set prices, and assign to playlists.

#### [NEW] [CircleVideos.tsx](file:///c:/Users/elink/scratch/MomNest/heart-lens-studio-main/src/components/circles/CircleVideos.tsx)
- Main tab component for the "Videos" section in Circle Detail.
- Displays horizontal playlists and a grid of video cards.

### Pages

#### [MODIFY] [CircleDetail.tsx](file:///c:/Users/elink/scratch/MomNest/heart-lens-studio-main/src/pages/CircleDetail.tsx)
- Add "Videos" tab to the `TabsList` and `TabsContent`.

## Verification Plan

### Manual Verification
1. **Database Schema**: Verify tables are created correctly in Supabase.
2. **Upload Flow**: 
   - Open a circle you own.
   - Go to the "Videos" tab.
   - Click "Add Video" and upload a landscape video with a price and description.
   - Verify it appears in the grid.
3. **Monetization**:
   - Log in as a different user who hasn't joined the circle or has joined but not paid for the video.
   - Verify the video is locked and shows the price.
   - Pay for the video and verify it becomes playable.
4. **Playlists**:
   - Create a playlist and add multiple videos.
   - Play a video from the playlist and verify "Next" video autoplay works.
5. **UI/UX**: 
   - Verify landscape aspect ratio is maintained.
   - Check responsiveness on mobile and desktop viewports.
