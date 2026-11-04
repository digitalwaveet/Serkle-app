-- ============================================
-- PHASE 1: HOME/SOCIAL FEED DATABASE SETUP
-- ============================================

-- Create profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null,
  email text not null,
  initials text not null,
  avatar_url text,
  avatar_color text not null default '#4B164C',
  cover_image_url text,
  bio text,
  subtitle text,
  location text,
  website text,
  is_verified boolean default false,
  is_online boolean default false,
  joined_date timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create index idx_profiles_username on public.profiles(username);
create index idx_profiles_created_at on public.profiles(created_at desc);

-- Create profile stats table
create table public.profile_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  followers_count integer default 0,
  following_count integer default 0,
  posts_count integer default 0,
  videos_count integer default 0,
  replies_count integer default 0,
  saves_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profile_stats enable row level security;

create policy "Stats are viewable by everyone"
  on public.profile_stats for select
  using (true);

-- Function to auto-create stats entry when profile is created
create or replace function public.create_profile_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_stats (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.create_profile_stats();

-- Create posts table
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  media_url text,
  media_alt text,
  media_color_from text,
  media_color_to text,
  tags text[] default '{}',
  is_sponsored boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select
  using (true);

create policy "Authenticated users can create posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own posts"
  on public.posts for update
  using (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

create index idx_posts_user_id on public.posts(user_id);
create index idx_posts_created_at on public.posts(created_at desc);
create index idx_posts_tags on public.posts using gin(tags);

-- Create post stats table
create table public.post_stats (
  post_id uuid primary key references public.posts(id) on delete cascade,
  likes_count integer default 0,
  comments_count integer default 0,
  shares_count integer default 0,
  saves_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.post_stats enable row level security;

create policy "Post stats are viewable by everyone"
  on public.post_stats for select
  using (true);

-- Auto-create stats when post is created
create or replace function public.create_post_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.post_stats (post_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_post_created
  after insert on public.posts
  for each row execute function public.create_post_stats();

-- Create likes table
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

alter table public.likes enable row level security;

create policy "Likes are viewable by everyone"
  on public.likes for select
  using (true);

create policy "Authenticated users can like posts"
  on public.likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike posts"
  on public.likes for delete
  using (auth.uid() = user_id);

create index idx_likes_post_id on public.likes(post_id);
create index idx_likes_user_id on public.likes(user_id);

-- Function to update like counts
create or replace function public.update_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.post_stats
    set likes_count = likes_count + 1
    where post_id = new.post_id;
  elsif (TG_OP = 'DELETE') then
    update public.post_stats
    set likes_count = likes_count - 1
    where post_id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger on_like_change
  after insert or delete on public.likes
  for each row execute function public.update_post_likes_count();

-- Create comments table
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select
  using (true);

create policy "Authenticated users can create comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own comments"
  on public.comments for update
  using (auth.uid() = user_id);

create policy "Users can delete own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

create index idx_comments_post_id on public.comments(post_id);
create index idx_comments_user_id on public.comments(user_id);
create index idx_comments_parent_id on public.comments(parent_id);
create index idx_comments_created_at on public.comments(created_at desc);

-- Function to update comment counts
create or replace function public.update_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.post_stats
    set comments_count = comments_count + 1
    where post_id = new.post_id;
  elsif (TG_OP = 'DELETE') then
    update public.post_stats
    set comments_count = comments_count - 1
    where post_id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger on_comment_change
  after insert or delete on public.comments
  for each row execute function public.update_post_comments_count();

-- Create comment likes table
create table public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  comment_id uuid references public.comments(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, comment_id)
);

alter table public.comment_likes enable row level security;

create policy "Comment likes are viewable by everyone"
  on public.comment_likes for select
  using (true);

create policy "Authenticated users can like comments"
  on public.comment_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike comments"
  on public.comment_likes for delete
  using (auth.uid() = user_id);

create index idx_comment_likes_comment_id on public.comment_likes(comment_id);
create index idx_comment_likes_user_id on public.comment_likes(user_id);

-- Create follows table
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

alter table public.follows enable row level security;

create policy "Follows are viewable by everyone"
  on public.follows for select
  using (true);

create policy "Authenticated users can follow others"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete
  using (auth.uid() = follower_id);

create index idx_follows_follower_id on public.follows(follower_id);
create index idx_follows_following_id on public.follows(following_id);

-- Function to update follower counts
create or replace function public.update_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.profile_stats
    set following_count = following_count + 1
    where user_id = new.follower_id;
    
    update public.profile_stats
    set followers_count = followers_count + 1
    where user_id = new.following_id;
  elsif (TG_OP = 'DELETE') then
    update public.profile_stats
    set following_count = following_count - 1
    where user_id = old.follower_id;
    
    update public.profile_stats
    set followers_count = followers_count - 1
    where user_id = old.following_id;
  end if;
  return null;
end;
$$;

create trigger on_follow_change
  after insert or delete on public.follows
  for each row execute function public.update_follow_counts();

-- Create saves table
create table public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

alter table public.saves enable row level security;

create policy "Users can view own saves"
  on public.saves for select
  using (auth.uid() = user_id);

create policy "Users can save posts"
  on public.saves for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave posts"
  on public.saves for delete
  using (auth.uid() = user_id);

create index idx_saves_user_id on public.saves(user_id);
create index idx_saves_post_id on public.saves(post_id);

-- Create stories table
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  media_url text not null,
  media_type text default 'image',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

alter table public.stories enable row level security;

create policy "Active stories are viewable by everyone"
  on public.stories for select
  using (expires_at > now());

create policy "Authenticated users can create stories"
  on public.stories for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own stories"
  on public.stories for delete
  using (auth.uid() = user_id);

create index idx_stories_user_id on public.stories(user_id);
create index idx_stories_expires_at on public.stories(expires_at);
create index idx_stories_created_at on public.stories(created_at desc);

-- Create story views table
create table public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete cascade not null,
  viewer_id uuid references public.profiles(id) on delete cascade not null,
  viewed_at timestamptz default now(),
  unique(story_id, viewer_id)
);

alter table public.story_views enable row level security;

create policy "Story views are viewable by story owner"
  on public.story_views for select
  using (
    exists (
      select 1 from public.stories
      where stories.id = story_id
      and stories.user_id = auth.uid()
    )
  );

create policy "Authenticated users can view stories"
  on public.story_views for insert
  with check (auth.uid() = viewer_id);

create index idx_story_views_story_id on public.story_views(story_id);
create index idx_story_views_viewer_id on public.story_views(viewer_id);

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create post-media bucket
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true);

create policy "Post media is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'post-media');

create policy "Authenticated users can upload post media"
  on storage.objects for insert
  with check (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own post media"
  on storage.objects for update
  using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own post media"
  on storage.objects for delete
  using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create story-media bucket
insert into storage.buckets (id, name, public)
values ('story-media', 'story-media', true);

create policy "Story media is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'story-media');

create policy "Authenticated users can upload story media"
  on storage.objects for insert
  with check (
    bucket_id = 'story-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own story media"
  on storage.objects for delete
  using (
    bucket_id = 'story-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- PROFILE AUTO-CREATION TRIGGER
-- ============================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _username text;
  _name text;
  _initials text;
begin
  _name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );
  
  _username := lower(split_part(new.email, '@', 1)) || '_' || substr(new.id::text, 1, 4);
  
  _initials := upper(
    left(split_part(_name, ' ', 1), 1) ||
    left(split_part(_name, ' ', 2), 1)
  );
  
  if length(_initials) < 2 then
    _initials := upper(left(_name, 2));
  end if;

  insert into public.profiles (
    id,
    username,
    name,
    email,
    initials,
    avatar_color
  ) values (
    new.id,
    _username,
    _name,
    new.email,
    _initials,
    '#' || substring(md5(new.id::text), 1, 6)
  );
  
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

create or replace function public.get_feed_posts(
  page_num integer default 0,
  page_size integer default 10
)
returns table (
  post_id uuid,
  content text,
  media_url text,
  media_alt text,
  media_color_from text,
  media_color_to text,
  tags text[],
  is_sponsored boolean,
  created_at timestamptz,
  user_id uuid,
  username text,
  name text,
  initials text,
  avatar_url text,
  avatar_color text,
  is_verified boolean,
  likes_count integer,
  comments_count integer,
  shares_count integer,
  saves_count integer,
  user_has_liked boolean
)
language sql
stable
as $$
  select
    p.id as post_id,
    p.content,
    p.media_url,
    p.media_alt,
    p.media_color_from,
    p.media_color_to,
    p.tags,
    p.is_sponsored,
    p.created_at,
    prof.id as user_id,
    prof.username,
    prof.name,
    prof.initials,
    prof.avatar_url,
    prof.avatar_color,
    prof.is_verified,
    ps.likes_count,
    ps.comments_count,
    ps.shares_count,
    ps.saves_count,
    exists(
      select 1 from public.likes l
      where l.post_id = p.id
      and l.user_id = auth.uid()
    ) as user_has_liked
  from public.posts p
  inner join public.profiles prof on p.user_id = prof.id
  inner join public.post_stats ps on p.id = ps.post_id
  order by p.created_at desc
  limit page_size
  offset page_num * page_size;
$$;

create or replace function public.get_post_comments(
  _post_id uuid
)
returns table (
  comment_id uuid,
  content text,
  created_at timestamptz,
  parent_id uuid,
  user_id uuid,
  username text,
  name text,
  initials text,
  avatar_url text,
  avatar_color text,
  likes_count bigint,
  user_has_liked boolean
)
language sql
stable
as $$
  select
    c.id as comment_id,
    c.content,
    c.created_at,
    c.parent_id,
    prof.id as user_id,
    prof.username,
    prof.name,
    prof.initials,
    prof.avatar_url,
    prof.avatar_color,
    count(cl.id) as likes_count,
    exists(
      select 1 from public.comment_likes cl2
      where cl2.comment_id = c.id
      and cl2.user_id = auth.uid()
    ) as user_has_liked
  from public.comments c
  inner join public.profiles prof on c.user_id = prof.id
  left join public.comment_likes cl on c.id = cl.comment_id
  where c.post_id = _post_id
  group by c.id, prof.id
  order by c.created_at asc;
$$;