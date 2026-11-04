-- Fix Story View RLS Policies to allow viewers to upsert their records

-- 1. DROP POLICY IF EXISTS to avoid naming conflicts if someone else added them or partial run
drop policy if exists "Users can view their own story views" on public.story_views;
drop policy if exists "Authenticated users can view stories" on public.story_views;
drop policy if exists "Users can update their own story views" on public.story_views;

-- 2. Allow viewers to select their own view records (needed for upsert conflict detection)
create policy "Users can view their own story views"
  on public.story_views for select
  using (auth.uid() = viewer_id);

-- 3. Ensure users can insert their own views (this replaces/augments existing policies if necessary)
create policy "Authenticated users can view stories"
  on public.story_views for insert
  with check (auth.uid() = viewer_id);

-- 4. Allow viewers to update their own view records (needed for timestamp refreshes on re-watch)
create policy "Users can update their own story views"
  on public.story_views for update
  using (auth.uid() = viewer_id)
  with check (auth.uid() = viewer_id);
