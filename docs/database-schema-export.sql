-- ============================================================================
-- HEART LENS STUDIO - Complete Database Schema Export
-- Generated: 2026-03-10
-- Platform: Supabase (PostgreSQL)
-- Tables: 103 | Enums: 2 | Functions: 40+ | Triggers: 47 | RLS Policies: 180+
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENUMS
-- ============================================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'super_admin');

CREATE TYPE public.coin_transaction_type AS ENUM (
  'topup', 'tip_sent', 'tip_received', 'purchase', 'sale',
  'event_payment', 'event_earned', 'service_payment', 'service_earned',
  'subscription', 'withdrawal', 'refund', 'premium_unlock', 'premium_earning'
);

-- ============================================================================
-- SECTION 2: TABLES
-- ============================================================================

-- --------------------------------------------------------------------------
-- profiles (core user data)
-- --------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  username text,
  name text,
  email text,
  bio text,
  avatar_url text,
  initials text,
  avatar_color text,
  is_verified boolean DEFAULT false,
  is_online boolean DEFAULT false,
  last_seen timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  push_subscription jsonb,
  push_enabled boolean DEFAULT false
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- profile_stats
-- --------------------------------------------------------------------------
CREATE TABLE public.profile_stats (
  user_id uuid NOT NULL PRIMARY KEY,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  videos_count integer DEFAULT 0,
  CONSTRAINT profile_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.profile_stats ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- user_roles
-- --------------------------------------------------------------------------
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- user_warnings
-- --------------------------------------------------------------------------
CREATE TABLE public.user_warnings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  created_at timestamp with time zone DEFAULT now(),
  acknowledged_at timestamp with time zone
);
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- follows
-- --------------------------------------------------------------------------
CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- posts
-- --------------------------------------------------------------------------
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text,
  media_url text,
  media_urls text[],
  cover_image_url text,
  media_alt text,
  media_color_from text,
  media_color_to text,
  tags text[],
  is_sponsored boolean DEFAULT false,
  circle_id uuid REFERENCES circles(id) ON DELETE SET NULL,
  is_premium boolean DEFAULT false,
  premium_price integer DEFAULT 0,
  voice_url text,
  location_text text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- post_stats
-- --------------------------------------------------------------------------
CREATE TABLE public.post_stats (
  post_id uuid NOT NULL PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  saves_count integer DEFAULT 0
);
ALTER TABLE public.post_stats ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- post_unlocks
-- --------------------------------------------------------------------------
CREATE TABLE public.post_unlocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_paid integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.post_unlocks ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- likes
-- --------------------------------------------------------------------------
CREATE TABLE public.likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, post_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- saves
-- --------------------------------------------------------------------------
CREATE TABLE public.saves (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, post_id)
);
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- comments
-- --------------------------------------------------------------------------
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- comment_likes
-- --------------------------------------------------------------------------
CREATE TABLE public.comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, comment_id)
);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- stories
-- --------------------------------------------------------------------------
CREATE TABLE public.stories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  filter text,
  stickers jsonb DEFAULT '[]'::jsonb,
  text_overlays jsonb DEFAULT '[]'::jsonb,
  background_color text,
  music_url text,
  music_name text,
  duration integer DEFAULT 5,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  shared_post_id uuid
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- story_views
-- --------------------------------------------------------------------------
CREATE TABLE public.story_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at timestamp with time zone DEFAULT now(),
  reaction text,
  UNIQUE (story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- story_likes
-- --------------------------------------------------------------------------
CREATE TABLE public.story_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (story_id, user_id)
);
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- story_mentions
-- --------------------------------------------------------------------------
CREATE TABLE public.story_mentions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (story_id, mentioned_user_id)
);
ALTER TABLE public.story_mentions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- story_messages
-- --------------------------------------------------------------------------
CREATE TABLE public.story_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.story_messages ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- scheduled_posts
-- --------------------------------------------------------------------------
CREATE TABLE public.scheduled_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content text,
  media_url text,
  tags text[],
  scheduled_for timestamp with time zone NOT NULL,
  status text DEFAULT 'scheduled',
  circle_id uuid,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- videos
-- --------------------------------------------------------------------------
CREATE TABLE public.videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  thumbnail_url text,
  title text,
  description text,
  tags text[],
  duration integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- video_stats
-- --------------------------------------------------------------------------
CREATE TABLE public.video_stats (
  video_id uuid NOT NULL PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  saves_count integer DEFAULT 0,
  views_count integer DEFAULT 0
);
ALTER TABLE public.video_stats ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- video_likes
-- --------------------------------------------------------------------------
CREATE TABLE public.video_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (video_id, user_id)
);
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- video_saves
-- --------------------------------------------------------------------------
CREATE TABLE public.video_saves (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (video_id, user_id)
);
ALTER TABLE public.video_saves ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- video_comments
-- --------------------------------------------------------------------------
CREATE TABLE public.video_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES video_comments(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- video_comment_likes
-- --------------------------------------------------------------------------
CREATE TABLE public.video_comment_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES video_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE public.video_comment_likes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- conversations
-- --------------------------------------------------------------------------
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_group boolean DEFAULT false,
  group_name text,
  group_avatar_url text,
  description text,
  created_by uuid,
  pinned_message_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- conversation_members
-- --------------------------------------------------------------------------
CREATE TABLE public.conversation_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone DEFAULT now(),
  last_read_at timestamp with time zone DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- messages
-- --------------------------------------------------------------------------
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  media_url text,
  media_urls text[],
  media_type text,
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  forwarded_from_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  voice_url text,
  voice_duration integer,
  poll_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Add pinned_message_id FK after messages table exists
ALTER TABLE public.conversations ADD CONSTRAINT conversations_pinned_message_id_fkey
  FOREIGN KEY (pinned_message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- message_reactions
-- --------------------------------------------------------------------------
CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- message_deletions
-- --------------------------------------------------------------------------
CREATE TABLE public.message_deletions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamp with time zone DEFAULT now(),
  UNIQUE (message_id, user_id)
);
ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- group_admins
-- --------------------------------------------------------------------------
CREATE TABLE public.group_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
ALTER TABLE public.group_admins ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- group_polls
-- --------------------------------------------------------------------------
CREATE TABLE public.group_polls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_anonymous boolean DEFAULT false,
  allows_multiple boolean DEFAULT false,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.group_polls ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- poll_votes
-- --------------------------------------------------------------------------
CREATE TABLE public.poll_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL REFERENCES group_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (poll_id, user_id, option_index)
);
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- group_mutes
-- --------------------------------------------------------------------------
CREATE TABLE public.group_mutes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  muted_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
ALTER TABLE public.group_mutes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- notification_preferences
-- --------------------------------------------------------------------------
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, notification_type)
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- push_notifications
-- --------------------------------------------------------------------------
CREATE TABLE public.push_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circles
-- --------------------------------------------------------------------------
CREATE TABLE public.circles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  avatar_url text,
  cover_image_url text,
  about_text text,
  guidelines text[],
  invite_code text NOT NULL UNIQUE,
  is_private boolean DEFAULT false,
  is_premium boolean DEFAULT false,
  is_expert boolean DEFAULT false,
  is_active boolean DEFAULT true,
  location text,
  subscription_enabled boolean DEFAULT false,
  subscription_price numeric DEFAULT 0,
  subscription_method text DEFAULT 'free',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_stats
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_stats (
  circle_id uuid NOT NULL PRIMARY KEY REFERENCES circles(id) ON DELETE CASCADE,
  members_count integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  events_count integer DEFAULT 0,
  resources_count integer DEFAULT 0,
  services_count integer DEFAULT 0,
  monthly_activity integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.circle_stats ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_members
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  status text DEFAULT 'active',
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE (circle_id, user_id)
);
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_messages
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.circle_messages ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_invitations
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitation_type text NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone
);
ALTER TABLE public.circle_invitations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_events
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  event_date date NOT NULL,
  event_time time NOT NULL,
  duration_minutes integer NOT NULL,
  timezone text DEFAULT 'UTC',
  platform text,
  meeting_url text,
  max_attendees integer,
  current_attendees integer DEFAULT 0,
  event_type text NOT NULL,
  price numeric DEFAULT 0,
  status text DEFAULT 'upcoming',
  recording_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.circle_events ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_event_attendees
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_event_attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES circle_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'registered',
  payment_status text DEFAULT 'unpaid',
  registered_at timestamp with time zone DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.circle_event_attendees ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_resources
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  resource_type text NOT NULL,
  file_url text NOT NULL,
  file_size_mb numeric,
  downloads_count integer DEFAULT 0,
  is_premium boolean DEFAULT false,
  rating numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.circle_resources ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_services
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  price numeric NOT NULL,
  duration_minutes integer NOT NULL,
  is_active boolean DEFAULT true,
  rating numeric,
  reviews_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.circle_services ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_service_bookings
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_service_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id uuid NOT NULL REFERENCES circle_services(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  member_email text NOT NULL,
  member_phone text,
  booking_date date NOT NULL,
  booking_time time NOT NULL,
  notes text,
  status text DEFAULT 'pending',
  payment_status text DEFAULT 'unpaid',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.circle_service_bookings ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_subscriptions
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'active',
  started_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (circle_id, user_id)
);
ALTER TABLE public.circle_subscriptions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_notification_preferences
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (circle_id, user_id)
);
ALTER TABLE public.circle_notification_preferences ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- circle_tips
-- --------------------------------------------------------------------------
CREATE TABLE public.circle_tips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tipper_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text DEFAULT 'coins',
  status text DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.circle_tips ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- coin_wallets
-- --------------------------------------------------------------------------
CREATE TABLE public.coin_wallets (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance integer DEFAULT 0,
  total_earned integer DEFAULT 0,
  total_spent integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- coin_transactions
-- --------------------------------------------------------------------------
CREATE TABLE public.coin_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type public.coin_transaction_type NOT NULL,
  reference_id uuid,
  description text NOT NULL,
  balance_after integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- coin_topups
-- --------------------------------------------------------------------------
CREATE TABLE public.coin_topups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  payment_method text DEFAULT 'demo',
  status text DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.coin_topups ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- coin_withdrawals
-- --------------------------------------------------------------------------
CREATE TABLE public.coin_withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  payout_method text,
  status text DEFAULT 'pending',
  notes text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.coin_withdrawals ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- questions (Ask feature)
-- --------------------------------------------------------------------------
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  question text NOT NULL,
  category text DEFAULT 'other',
  tags text[],
  is_anonymous boolean DEFAULT true,
  anonymous_name text,
  is_thread boolean DEFAULT false,
  ai_response text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- answers
-- --------------------------------------------------------------------------
CREATE TABLE public.answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  answer text NOT NULL,
  is_helpful boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- answer_votes
-- --------------------------------------------------------------------------
CREATE TABLE public.answer_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  answer_id uuid NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (answer_id, user_id)
);
ALTER TABLE public.answer_votes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- question_votes
-- --------------------------------------------------------------------------
CREATE TABLE public.question_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (question_id, user_id)
);
ALTER TABLE public.question_votes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- question_bookmarks
-- --------------------------------------------------------------------------
CREATE TABLE public.question_bookmarks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (question_id, user_id)
);
ALTER TABLE public.question_bookmarks ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- thread_updates
-- --------------------------------------------------------------------------
CREATE TABLE public.thread_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.thread_updates ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- thread_update_votes
-- --------------------------------------------------------------------------
CREATE TABLE public.thread_update_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_update_id uuid NOT NULL REFERENCES thread_updates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (thread_update_id, user_id)
);
ALTER TABLE public.thread_update_votes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- expert_profiles
-- --------------------------------------------------------------------------
CREATE TABLE public.expert_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty text NOT NULL,
  bio text,
  years_experience integer,
  certifications text[],
  is_verified boolean DEFAULT false,
  verified boolean,
  featured_answer_id uuid REFERENCES answers(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- expert_verification_requests
-- --------------------------------------------------------------------------
CREATE TABLE public.expert_verification_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  specialty text NOT NULL,
  bio text,
  years_experience integer,
  certifications text[],
  status text DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.expert_verification_requests ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- live_streams
-- --------------------------------------------------------------------------
CREATE TABLE public.live_streams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id uuid REFERENCES circles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text DEFAULT 'camera',
  status text DEFAULT 'live',
  viewer_count integer DEFAULT 0,
  thumbnail_url text,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- live_viewers
-- --------------------------------------------------------------------------
CREATE TABLE public.live_viewers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id uuid NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  joined_at timestamp with time zone DEFAULT now(),
  left_at timestamp with time zone,
  UNIQUE (stream_id, user_id)
);
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- live_messages
-- --------------------------------------------------------------------------
CREATE TABLE public.live_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id uuid NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  type text DEFAULT 'chat',
  gift_emoji text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- shop_items
-- --------------------------------------------------------------------------
CREATE TABLE public.shop_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  price numeric NOT NULL,
  original_price numeric,
  category text NOT NULL,
  subcategory text,
  condition text DEFAULT 'new',
  images text[] DEFAULT '{}',
  tags text[],
  status text DEFAULT 'active',
  stock integer DEFAULT 1,
  location text,
  shipping_options jsonb DEFAULT '[]'::jsonb,
  specifications jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- shop_item_stats
-- --------------------------------------------------------------------------
CREATE TABLE public.shop_item_stats (
  item_id uuid NOT NULL PRIMARY KEY REFERENCES shop_items(id) ON DELETE CASCADE,
  likes_count integer DEFAULT 0,
  saves_count integer DEFAULT 0,
  views_count integer DEFAULT 0,
  comments_count integer DEFAULT 0
);
ALTER TABLE public.shop_item_stats ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- shop_item_likes
-- --------------------------------------------------------------------------
CREATE TABLE public.shop_item_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (item_id, user_id)
);
ALTER TABLE public.shop_item_likes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- shop_item_saves
-- --------------------------------------------------------------------------
CREATE TABLE public.shop_item_saves (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (item_id, user_id)
);
ALTER TABLE public.shop_item_saves ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- shop_item_comments
-- --------------------------------------------------------------------------
CREATE TABLE public.shop_item_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES shop_item_comments(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.shop_item_comments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- seller_profiles
-- --------------------------------------------------------------------------
CREATE TABLE public.seller_profiles (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  store_description text,
  store_logo_url text,
  store_banner_url text,
  business_type text DEFAULT 'individual',
  is_verified boolean DEFAULT false,
  verification_status text DEFAULT 'unverified',
  rating numeric DEFAULT 0,
  total_sales integer DEFAULT 0,
  joined_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- seller_stats
-- --------------------------------------------------------------------------
CREATE TABLE public.seller_stats (
  seller_id uuid NOT NULL PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_revenue numeric DEFAULT 0,
  total_orders integer DEFAULT 0,
  active_listings integer DEFAULT 0,
  followers_count integer DEFAULT 0,
  avg_rating numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- seller_follows
-- --------------------------------------------------------------------------
CREATE TABLE public.seller_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (follower_id, seller_id)
);
ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- seller_reviews
-- --------------------------------------------------------------------------
CREATE TABLE public.seller_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  review text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- orders
-- --------------------------------------------------------------------------
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_number text NOT NULL UNIQUE,
  status text DEFAULT 'pending',
  total_amount numeric NOT NULL,
  shipping_address_id uuid,
  payment_method text DEFAULT 'coins',
  notes text,
  tracking_number text,
  estimated_delivery timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- order_items
-- --------------------------------------------------------------------------
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1,
  price numeric NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- flash_sales
-- --------------------------------------------------------------------------
CREATE TABLE public.flash_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  original_price numeric NOT NULL,
  sale_price numeric NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  quantity_limit integer,
  quantity_sold integer DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- group_buys
-- --------------------------------------------------------------------------
CREATE TABLE public.group_buys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  min_participants integer NOT NULL,
  max_participants integer,
  current_participants integer DEFAULT 0,
  group_price numeric NOT NULL,
  status text DEFAULT 'active',
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.group_buys ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- group_buy_participants
-- --------------------------------------------------------------------------
CREATE TABLE public.group_buy_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_buy_id uuid NOT NULL REFERENCES group_buys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE (group_buy_id, user_id)
);
ALTER TABLE public.group_buy_participants ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- product_reviews
-- --------------------------------------------------------------------------
CREATE TABLE public.product_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  rating integer NOT NULL,
  review text,
  images text[],
  helpful_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- review_helpful
-- --------------------------------------------------------------------------
CREATE TABLE public.review_helpful (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (review_id, user_id)
);
ALTER TABLE public.review_helpful ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- disputes
-- --------------------------------------------------------------------------
CREATE TABLE public.disputes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  reason text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'open',
  resolution text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- refunds
-- --------------------------------------------------------------------------
CREATE TABLE public.refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id uuid NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text DEFAULT 'pending',
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- shipping_addresses
-- --------------------------------------------------------------------------
CREATE TABLE public.shipping_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text DEFAULT 'Home',
  full_name text NOT NULL,
  phone text,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text,
  postal_code text,
  country text DEFAULT 'US',
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- payment_methods
-- --------------------------------------------------------------------------
CREATE TABLE public.payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  label text NOT NULL,
  last_four text,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- shop_conversations
-- --------------------------------------------------------------------------
CREATE TABLE public.shop_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id uuid REFERENCES shop_items(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.shop_conversations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- shop_messages
-- --------------------------------------------------------------------------
CREATE TABLE public.shop_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES shop_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.shop_messages ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- sos_alerts
-- --------------------------------------------------------------------------
CREATE TABLE public.sos_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sos_type text NOT NULL,
  sub_category text,
  urgency text DEFAULT 'medium',
  description text,
  status text DEFAULT 'active',
  location_lat numeric,
  location_lng numeric,
  location_address text,
  share_live_location boolean DEFAULT false,
  person_age text,
  person_description text,
  last_seen text,
  injury_type text,
  conscious_level text,
  threat_active boolean DEFAULT false,
  photo_urls text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- sos_helpers
-- --------------------------------------------------------------------------
CREATE TABLE public.sos_helpers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
  helper_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'responding',
  eta_minutes integer,
  location_lat numeric,
  location_lng numeric,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (alert_id, helper_user_id)
);
ALTER TABLE public.sos_helpers ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- sos_messages
-- --------------------------------------------------------------------------
CREATE TABLE public.sos_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text DEFAULT 'text',
  media_url text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.sos_messages ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- sos_reviews
-- --------------------------------------------------------------------------
CREATE TABLE public.sos_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL,
  helper_user_id uuid NOT NULL,
  rating integer NOT NULL,
  review text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (alert_id, reviewer_user_id, helper_user_id)
);
ALTER TABLE public.sos_reviews ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- helper_profiles
-- --------------------------------------------------------------------------
CREATE TABLE public.helper_profiles (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_available boolean DEFAULT false,
  availability_status text DEFAULT 'offline',
  location_lat numeric,
  location_lng numeric,
  location_address text,
  skills text[],
  bio text,
  response_count integer DEFAULT 0,
  completion_count integer DEFAULT 0,
  avg_rating numeric DEFAULT 0,
  current_streak_days integer DEFAULT 0,
  last_response_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.helper_profiles ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- helper_requests
-- --------------------------------------------------------------------------
CREATE TABLE public.helper_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  helper_id uuid NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone
);
ALTER TABLE public.helper_requests ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- emergency_contacts
-- --------------------------------------------------------------------------
CREATE TABLE public.emergency_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  relationship text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- abuse_reports
-- --------------------------------------------------------------------------
CREATE TABLE public.abuse_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  alert_id uuid REFERENCES sos_alerts(id) ON DELETE SET NULL,
  report_type text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text
);
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- content_reports
-- --------------------------------------------------------------------------
CREATE TABLE public.content_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id uuid NOT NULL,
  content_type text NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  priority text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- content_review_queue
-- --------------------------------------------------------------------------
CREATE TABLE public.content_review_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  content_preview text,
  reason text DEFAULT 'flagged',
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  assigned_to uuid,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.content_review_queue ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- appeals
-- --------------------------------------------------------------------------
CREATE TABLE public.appeals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  appeal_type text DEFAULT 'ban',
  reason text NOT NULL,
  evidence_urls text[],
  status text DEFAULT 'pending',
  moderator_id uuid,
  moderator_notes text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- admin_audit_log
-- --------------------------------------------------------------------------
CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- admin_broadcasts
-- --------------------------------------------------------------------------
CREATE TABLE public.admin_broadcasts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  target_audience text DEFAULT 'all',
  channel text DEFAULT 'in_app',
  status text DEFAULT 'draft',
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- admin_notifications
-- --------------------------------------------------------------------------
CREATE TABLE public.admin_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type text DEFAULT 'info',
  title text NOT NULL,
  message text,
  severity text DEFAULT 'info',
  is_read boolean DEFAULT false,
  action_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- admin_settings
-- --------------------------------------------------------------------------
CREATE TABLE public.admin_settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- ai_moderation_results
-- --------------------------------------------------------------------------
CREATE TABLE public.ai_moderation_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  content_text text,
  user_id uuid,
  spam_score numeric DEFAULT 0,
  hate_score numeric DEFAULT 0,
  nsfw_score numeric DEFAULT 0,
  overall_risk text DEFAULT 'low',
  ai_reasoning text,
  auto_action text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_action text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.ai_moderation_results ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- auto_moderation_rules
-- --------------------------------------------------------------------------
CREATE TABLE public.auto_moderation_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  rule_type text DEFAULT 'threshold',
  conditions jsonb DEFAULT '{}'::jsonb,
  action text DEFAULT 'flag',
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.auto_moderation_rules ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- bulk_action_logs
-- --------------------------------------------------------------------------
CREATE TABLE public.bulk_action_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_ids uuid[] DEFAULT '{}',
  performed_by uuid NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.bulk_action_logs ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- platform_health_snapshots
-- --------------------------------------------------------------------------
CREATE TABLE public.platform_health_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.platform_health_snapshots ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- webhook_endpoints
-- --------------------------------------------------------------------------
CREATE TABLE public.webhook_endpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  events text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  secret text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 3: INDEXES (non-primary-key, non-unique-constraint)
-- ============================================================================

CREATE INDEX idx_abuse_reports_alert ON abuse_reports USING btree (alert_id) WHERE (alert_id IS NOT NULL);
CREATE INDEX idx_abuse_reports_status ON abuse_reports USING btree (status, created_at DESC);
CREATE INDEX idx_ai_moderation_content ON ai_moderation_results USING btree (content_type, content_id);
CREATE INDEX idx_ai_moderation_created ON ai_moderation_results USING btree (created_at DESC);
CREATE INDEX idx_ai_moderation_risk ON ai_moderation_results USING btree (overall_risk);
CREATE INDEX idx_answers_question_id ON answers USING btree (question_id);
CREATE INDEX idx_answers_user_id ON answers USING btree (user_id);
CREATE INDEX idx_circle_messages_circle_id ON circle_messages USING btree (circle_id, created_at DESC);
CREATE INDEX idx_circle_messages_sender_id ON circle_messages USING btree (sender_id, circle_id);
CREATE INDEX idx_service_bookings_service_id ON circle_service_bookings USING btree (service_id);
CREATE INDEX idx_service_bookings_status ON circle_service_bookings USING btree (status);
CREATE INDEX idx_service_bookings_user_id ON circle_service_bookings USING btree (user_id);
CREATE INDEX idx_coin_topups_user_id ON coin_topups USING btree (user_id);
CREATE INDEX idx_coin_transactions_user_id ON coin_transactions USING btree (user_id, created_at DESC);
CREATE INDEX idx_coin_withdrawals_user_id ON coin_withdrawals USING btree (user_id);
CREATE INDEX idx_comment_likes_comment_id ON comment_likes USING btree (comment_id);
CREATE INDEX idx_comment_likes_user_id ON comment_likes USING btree (user_id);
CREATE INDEX idx_comments_created_at ON comments USING btree (created_at DESC);
CREATE INDEX idx_comments_parent_id ON comments USING btree (parent_id);
CREATE INDEX idx_comments_post_id ON comments USING btree (post_id);
CREATE INDEX idx_comments_user_id ON comments USING btree (user_id);
CREATE INDEX idx_conversation_members_conversation_id ON conversation_members USING btree (conversation_id);
CREATE INDEX idx_conversation_members_user_id ON conversation_members USING btree (user_id);
CREATE INDEX idx_disputes_buyer ON disputes USING btree (buyer_id);
CREATE INDEX idx_disputes_order ON disputes USING btree (order_id);
CREATE INDEX idx_disputes_seller ON disputes USING btree (seller_id);
CREATE INDEX idx_flash_sales_item ON flash_sales USING btree (item_id);
CREATE INDEX idx_flash_sales_status ON flash_sales USING btree (status);
CREATE INDEX idx_follows_follower_id ON follows USING btree (follower_id);
CREATE INDEX idx_follows_following_id ON follows USING btree (following_id);
CREATE INDEX idx_group_buys_item ON group_buys USING btree (item_id);
CREATE INDEX idx_helper_profiles_availability ON helper_profiles USING btree (is_available, availability_status);
CREATE INDEX idx_helper_profiles_available ON helper_profiles USING btree (is_available, location_lat, location_lng) WHERE (is_available = true);
CREATE INDEX idx_helper_profiles_last_response ON helper_profiles USING btree (last_response_date);
CREATE INDEX idx_helper_profiles_location ON helper_profiles USING btree (location_lat, location_lng);
CREATE INDEX idx_helper_requests_alert_id ON helper_requests USING btree (alert_id);
CREATE INDEX idx_helper_requests_helper_id ON helper_requests USING btree (helper_id);
CREATE INDEX idx_helper_requests_status ON helper_requests USING btree (status);
CREATE INDEX idx_likes_post_id ON likes USING btree (post_id);
CREATE INDEX idx_likes_user_id ON likes USING btree (user_id);
CREATE INDEX idx_live_messages_created_at ON live_messages USING btree (created_at DESC);
CREATE INDEX idx_live_messages_stream_id ON live_messages USING btree (stream_id);
CREATE INDEX idx_live_streams_status ON live_streams USING btree (status);
CREATE INDEX idx_live_streams_user_id ON live_streams USING btree (user_id);
CREATE INDEX idx_live_viewers_stream_id ON live_viewers USING btree (stream_id);
CREATE INDEX idx_messages_conversation_id ON messages USING btree (conversation_id);
CREATE INDEX idx_messages_created_at ON messages USING btree (created_at DESC);
CREATE INDEX idx_notification_prefs_user ON notification_preferences USING btree (user_id) WHERE (enabled = true);

-- ============================================================================
-- SECTION 4: TRIGGERS
-- ============================================================================

CREATE TRIGGER update_answers_updated_at BEFORE UPDATE ON answers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER on_circle_member_change AFTER INSERT OR DELETE OR UPDATE ON circle_members FOR EACH ROW EXECUTE FUNCTION update_circle_member_count();
CREATE TRIGGER circle_resources_count_trigger AFTER INSERT OR DELETE ON circle_resources FOR EACH ROW EXECUTE FUNCTION update_circle_resources_count();
CREATE TRIGGER update_service_bookings_updated_at BEFORE UPDATE ON circle_service_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER on_circle_created AFTER INSERT ON circles FOR EACH ROW EXECUTE FUNCTION create_circle_stats();
CREATE TRIGGER set_circle_invite_code BEFORE INSERT ON circles FOR EACH ROW EXECUTE FUNCTION generate_circle_invite_code();
CREATE TRIGGER on_comment_change AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();
CREATE TRIGGER on_post_comment AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION notify_post_comment();
CREATE TRIGGER update_expert_profiles_updated_at BEFORE UPDATE ON expert_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER "Push on New Follow" AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION trigger_push_notification_webhook();
CREATE TRIGGER on_follow_change AFTER INSERT OR DELETE ON follows FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
CREATE TRIGGER on_new_follower AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION notify_new_follower();
CREATE TRIGGER update_group_buy_participants_count_trigger AFTER INSERT OR DELETE ON group_buy_participants FOR EACH ROW EXECUTE FUNCTION update_group_buy_participants_count();
CREATE TRIGGER update_helper_profiles_updated_at BEFORE UPDATE ON helper_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER on_like_change AFTER INSERT OR DELETE ON likes FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();
CREATE TRIGGER on_post_like AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION notify_post_like();
CREATE TRIGGER trigger_update_live_viewer_count AFTER INSERT OR DELETE OR UPDATE ON live_viewers FOR EACH ROW EXECUTE FUNCTION update_live_viewer_count();
CREATE TRIGGER "Push on New Message" AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION trigger_push_notification_webhook();
CREATE TRIGGER update_conversation_on_message AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER on_circle_post_change AFTER INSERT OR DELETE OR UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_circle_post_count();
CREATE TRIGGER on_new_post AFTER INSERT ON posts FOR EACH ROW EXECUTE FUNCTION notify_followers_new_post();
CREATE TRIGGER on_post_created AFTER INSERT ON posts FOR EACH ROW EXECUTE FUNCTION create_post_stats();
CREATE TRIGGER on_profile_created AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION create_profile_stats();
CREATE TRIGGER on_profile_created_create_wallet AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION create_coin_wallet();
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_review_helpful_count_trigger AFTER INSERT OR DELETE ON review_helpful FOR EACH ROW EXECUTE FUNCTION update_review_helpful_count();
CREATE TRIGGER update_seller_followers_count_trigger AFTER INSERT OR DELETE ON seller_follows FOR EACH ROW EXECUTE FUNCTION update_seller_followers_count();
CREATE TRIGGER create_seller_stats_trigger AFTER INSERT ON seller_profiles FOR EACH ROW EXECUTE FUNCTION create_seller_stats();
CREATE TRIGGER update_shop_item_comments_count_trigger AFTER INSERT OR DELETE ON shop_item_comments FOR EACH ROW EXECUTE FUNCTION update_shop_item_comments_count();
CREATE TRIGGER update_shop_item_comments_updated_at BEFORE UPDATE ON shop_item_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shop_item_likes_count_trigger AFTER INSERT OR DELETE ON shop_item_likes FOR EACH ROW EXECUTE FUNCTION update_shop_item_likes_count();
CREATE TRIGGER update_shop_item_saves_count_trigger AFTER INSERT OR DELETE ON shop_item_saves FOR EACH ROW EXECUTE FUNCTION update_shop_item_saves_count();
CREATE TRIGGER create_shop_item_stats_trigger AFTER INSERT ON shop_items FOR EACH ROW EXECUTE FUNCTION create_shop_item_stats();
CREATE TRIGGER update_seller_active_listings_trigger AFTER INSERT OR DELETE OR UPDATE ON shop_items FOR EACH ROW EXECUTE FUNCTION update_seller_active_listings();
CREATE TRIGGER update_shop_items_updated_at BEFORE UPDATE ON shop_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_helper_stats_on_resolution AFTER UPDATE ON sos_alerts FOR EACH ROW EXECUTE FUNCTION update_helper_completion_stats();
CREATE TRIGGER update_sos_alerts_updated_at BEFORE UPDATE ON sos_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_helper_stats_on_response AFTER INSERT ON sos_helpers FOR EACH ROW EXECUTE FUNCTION update_helper_response_stats();
CREATE TRIGGER on_video_comment AFTER INSERT ON video_comments FOR EACH ROW EXECUTE FUNCTION notify_video_comment();
CREATE TRIGGER on_video_comment_change AFTER INSERT OR DELETE ON video_comments FOR EACH ROW EXECUTE FUNCTION update_video_comments_count();
CREATE TRIGGER on_video_like AFTER INSERT ON video_likes FOR EACH ROW EXECUTE FUNCTION notify_video_like();
CREATE TRIGGER on_video_like_change AFTER INSERT OR DELETE ON video_likes FOR EACH ROW EXECUTE FUNCTION update_video_likes_count();
CREATE TRIGGER on_video_save_change AFTER INSERT OR DELETE ON video_saves FOR EACH ROW EXECUTE FUNCTION update_video_saves_count();
CREATE TRIGGER on_new_video AFTER INSERT ON videos FOR EACH ROW EXECUTE FUNCTION notify_followers_new_video();
CREATE TRIGGER on_video_count_change AFTER INSERT OR DELETE ON videos FOR EACH ROW EXECUTE FUNCTION update_profile_video_count();
CREATE TRIGGER on_video_created AFTER INSERT ON videos FOR EACH ROW EXECUTE FUNCTION create_video_stats();

-- ============================================================================
-- SECTION 5: REALTIME PUBLICATIONS
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_resources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;

-- ============================================================================
-- SECTION 6: RLS POLICIES (abbreviated - see full project for complete policy definitions)
-- Note: All 103 tables have RLS enabled.
-- Key patterns:
--   - Public read: profiles, posts, videos, questions, answers, follows, etc.
--   - Owner-only write: auth.uid() = user_id
--   - Admin access: is_any_admin(auth.uid())
--   - Circle member access: is_circle_member(circle_id, auth.uid())
--   - Conversation member access: is_conversation_member(conversation_id, auth.uid())
-- ============================================================================

-- profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- profile_stats
CREATE POLICY "Stats are viewable by everyone" ON profile_stats FOR SELECT USING (true);

-- user_roles
CREATE POLICY "Admins can view all roles" ON user_roles FOR SELECT USING (is_any_admin(auth.uid()));
CREATE POLICY "Super admins can manage roles" ON user_roles FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- user_warnings
CREATE POLICY "Admins can manage warnings" ON user_warnings FOR ALL USING (is_any_admin(auth.uid()));

-- follows
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
CREATE POLICY "Authenticated users can follow others" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- posts
CREATE POLICY "posts_select_policy" ON posts FOR SELECT USING (
  CASE
    WHEN circle_id IS NULL THEN (COALESCE(is_premium, false) = false OR auth.uid() = user_id)
    ELSE (auth.uid() = user_id OR EXISTS(SELECT 1 FROM circles WHERE circles.id = posts.circle_id AND circles.creator_id = auth.uid()) OR is_circle_member(circle_id, auth.uid()))
  END
);
CREATE POLICY "posts_insert_policy" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update_policy" ON posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete_policy" ON posts FOR DELETE USING (auth.uid() = user_id);

-- post_stats
CREATE POLICY "Post stats are viewable by everyone" ON post_stats FOR SELECT USING (true);

-- likes
CREATE POLICY "Likes are viewable by everyone" ON likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like posts" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike posts" ON likes FOR DELETE USING (auth.uid() = user_id);

-- saves
CREATE POLICY "Users can view own saves" ON saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save posts" ON saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON saves FOR DELETE USING (auth.uid() = user_id);

-- comments
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- comment_likes
CREATE POLICY "Comment likes are viewable by everyone" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like comments" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike comments" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- stories
CREATE POLICY "Active stories are viewable by everyone" ON stories FOR SELECT USING (expires_at > now());
CREATE POLICY "Authenticated users can create stories" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON stories FOR DELETE USING (auth.uid() = user_id);

-- videos
CREATE POLICY "Videos are viewable by everyone" ON videos FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON videos FOR DELETE USING (auth.uid() = user_id);

-- video_stats
CREATE POLICY "Video stats are viewable by everyone" ON video_stats FOR SELECT USING (true);

-- video_likes
CREATE POLICY "Video likes are viewable by everyone" ON video_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like videos" ON video_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike videos" ON video_likes FOR DELETE USING (auth.uid() = user_id);

-- video_saves
CREATE POLICY "Users can view own video saves" ON video_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save videos" ON video_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave videos" ON video_saves FOR DELETE USING (auth.uid() = user_id);

-- video_comments
CREATE POLICY "Video comments are viewable by everyone" ON video_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create video comments" ON video_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own video comments" ON video_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own video comments" ON video_comments FOR DELETE USING (auth.uid() = user_id);

-- video_comment_likes
CREATE POLICY "Video comment likes are viewable by everyone" ON video_comment_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like video comments" ON video_comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike video comments" ON video_comment_likes FOR DELETE USING (auth.uid() = user_id);

-- conversations
CREATE POLICY "Users can view conversations they are part of" ON conversations FOR SELECT USING (EXISTS(SELECT 1 FROM conversation_members WHERE conversation_members.conversation_id = conversations.id AND conversation_members.user_id = auth.uid()));
CREATE POLICY "Members can update conversation pin" ON conversations FOR UPDATE USING (EXISTS(SELECT 1 FROM conversation_members WHERE conversation_members.conversation_id = conversations.id AND conversation_members.user_id = auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM conversation_members WHERE conversation_members.conversation_id = conversations.id AND conversation_members.user_id = auth.uid()));

-- messages
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT USING (is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Users can send messages to their conversations" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Senders can update own messages" ON messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "Users can delete their own messages" ON messages FOR DELETE USING (auth.uid() = sender_id);

-- circles
CREATE POLICY "Public circles viewable by everyone" ON circles FOR SELECT USING (NOT is_private OR is_circle_member(id, auth.uid()) OR creator_id = auth.uid());
CREATE POLICY "Authenticated users can create circles" ON circles FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their circles" ON circles FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete their circles" ON circles FOR DELETE USING (auth.uid() = creator_id);

-- circle_stats
CREATE POLICY "Circle stats viewable by everyone" ON circle_stats FOR SELECT USING (true);

-- circle_members
CREATE POLICY "Members viewable by members or public circles" ON circle_members FOR SELECT USING (EXISTS(SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND NOT circles.is_private) OR is_circle_member(circle_id, auth.uid()));
CREATE POLICY "Users can join circles" ON circle_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave circles or creators can remove members" ON circle_members FOR DELETE USING (auth.uid() = user_id OR EXISTS(SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.creator_id = auth.uid()));

-- questions
CREATE POLICY "Anyone can view questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Anyone can create questions" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own questions" ON questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own questions" ON questions FOR DELETE USING (auth.uid() = user_id);

-- answers
CREATE POLICY "Anyone can view answers" ON answers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create answers" ON answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own answers" ON answers FOR DELETE USING (auth.uid() = user_id);

-- expert_profiles
CREATE POLICY "Anyone can view expert profiles" ON expert_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create own expert profile" ON expert_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expert profile" ON expert_profiles FOR UPDATE USING (auth.uid() = user_id);

-- shop_items
CREATE POLICY "Anyone can view active shop items" ON shop_items FOR SELECT USING (status = 'active');
CREATE POLICY "Authenticated users can create shop items" ON shop_items FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update own shop items" ON shop_items FOR UPDATE USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete own shop items" ON shop_items FOR DELETE USING (auth.uid() = seller_id);

-- sos_alerts
CREATE POLICY "Users can view own SOS alerts" ON sos_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view active SOS alerts from others" ON sos_alerts FOR SELECT USING (status IN ('active', 'responding') AND auth.uid() <> user_id);
CREATE POLICY "Authenticated users can create SOS alerts" ON sos_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own SOS alerts" ON sos_alerts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own SOS alerts" ON sos_alerts FOR DELETE USING (auth.uid() = user_id);

-- (Additional policies for remaining tables follow the same patterns above)
-- Full policy list includes 180+ policies across all 103 tables.

-- ============================================================================
-- END OF SCHEMA EXPORT
-- ============================================================================
