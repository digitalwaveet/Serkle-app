-- Refined Story View RLS Policies
-- This migration drops ALL existing policies on story_views and recreates them cleanly.

-- 1. Drop all potentially conflicting policies
drop policy if exists "Story views are viewable by story owner" on public.story_views;
drop policy if exists "Authenticated users can view stories" on public.story_views;
drop policy if exists "Users can view their own story views" on public.story_views;
drop policy if exists "Users can update their own story views" on public.story_views;

-- 2. Allow viewers to select their own view records
create policy "story_views_viewer_select"
  on public.story_views for select
  using (auth.uid() = viewer_id);

-- 3. Allow viewers to insert their own view records
create policy "story_views_viewer_insert"
  on public.story_views for insert
  with check (auth.uid() = viewer_id);

-- 4. Allow viewers to update their own view records (needed for timestamp refreshes)
create policy "story_views_viewer_update"
  on public.story_views for update
  using (auth.uid() = viewer_id)
  with check (auth.uid() = viewer_id);

-- 5. Allow story owners to see who viewed their stories
create policy "story_views_owner_select"
  on public.story_views for select
  using (
    exists (
      select 1 from public.stories
      where stories.id = story_views.story_id
      and stories.user_id = auth.uid()
    )
  );
