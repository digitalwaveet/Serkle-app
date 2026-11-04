-- Phase 1: Core Circles Tables

-- Create circles table
CREATE TABLE IF NOT EXISTS public.circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT,
  
  -- Images
  avatar_url TEXT,
  cover_image_url TEXT,
  
  -- Settings
  is_private BOOLEAN DEFAULT false,
  is_premium BOOLEAN DEFAULT false,
  is_expert BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Creator
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create circle_members table
CREATE TABLE IF NOT EXISTS public.circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'moderator', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'banned')),
  
  joined_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(circle_id, user_id)
);

-- Create circle_stats table
CREATE TABLE IF NOT EXISTS public.circle_stats (
  circle_id UUID PRIMARY KEY REFERENCES public.circles(id) ON DELETE CASCADE,
  
  members_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  services_count INTEGER DEFAULT 0,
  resources_count INTEGER DEFAULT 0,
  monthly_activity INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 2: Content Tables

-- Extend posts table with circle_id
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_posts_circle_id ON public.posts(circle_id);

-- Create circle_events table
CREATE TABLE IF NOT EXISTS public.circle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  
  platform TEXT,
  meeting_url TEXT,
  
  max_attendees INTEGER,
  current_attendees INTEGER DEFAULT 0,
  
  event_type TEXT NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create circle_event_attendees table
CREATE TABLE IF NOT EXISTS public.circle_event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.circle_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'cancelled')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  
  registered_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(event_id, user_id)
);

-- Create circle_services table
CREATE TABLE IF NOT EXISTS public.circle_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  
  rating DECIMAL(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  
  provider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create circle_resources table
CREATE TABLE IF NOT EXISTS public.circle_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_mb DECIMAL(10,2),
  
  is_premium BOOLEAN DEFAULT false,
  
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 3: Interaction Tables

-- Create circle_tips table
CREATE TABLE IF NOT EXISTS public.circle_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  
  tipper_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 4: RLS Policies

-- Enable RLS on all tables
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_tips ENABLE ROW LEVEL SECURITY;

-- Circles RLS Policies
CREATE POLICY "Public circles viewable by everyone" ON public.circles
  FOR SELECT USING (NOT is_private OR EXISTS (
    SELECT 1 FROM public.circle_members 
    WHERE circle_id = circles.id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Authenticated users can create circles" ON public.circles
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their circles" ON public.circles
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their circles" ON public.circles
  FOR DELETE USING (auth.uid() = creator_id);

-- Circle Members RLS Policies
CREATE POLICY "Members viewable by circle members" ON public.circle_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circles WHERE id = circle_id AND NOT is_private)
    OR EXISTS (SELECT 1 FROM public.circle_members cm WHERE cm.circle_id = circle_members.circle_id AND cm.user_id = auth.uid() AND cm.status = 'active')
  );

CREATE POLICY "Users can join circles" ON public.circle_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave circles or creators can remove members" ON public.circle_members
  FOR DELETE USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.circles WHERE id = circle_id AND creator_id = auth.uid())
  );

-- Circle Stats RLS Policies
CREATE POLICY "Circle stats viewable by everyone" ON public.circle_stats
  FOR SELECT USING (true);

-- Circle Events RLS Policies
CREATE POLICY "Circle members can view events" ON public.circle_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_events.circle_id AND user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY "Circle creators can create events" ON public.circle_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.circles WHERE id = circle_id AND creator_id = auth.uid())
  );

CREATE POLICY "Event creators can update events" ON public.circle_events
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Event creators can delete events" ON public.circle_events
  FOR DELETE USING (auth.uid() = creator_id);

-- Event Attendees RLS Policies
CREATE POLICY "Users can view event attendees" ON public.circle_event_attendees
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circle_events ce 
      INNER JOIN public.circle_members cm ON ce.circle_id = cm.circle_id 
      WHERE ce.id = event_id AND cm.user_id = auth.uid() AND cm.status = 'active')
  );

CREATE POLICY "Users can register for events" ON public.circle_event_attendees
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel registration" ON public.circle_event_attendees
  FOR DELETE USING (auth.uid() = user_id);

-- Circle Services RLS Policies
CREATE POLICY "Circle members can view services" ON public.circle_services
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_services.circle_id AND user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY "Providers can create services" ON public.circle_services
  FOR INSERT WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Providers can update services" ON public.circle_services
  FOR UPDATE USING (auth.uid() = provider_id);

CREATE POLICY "Providers can delete services" ON public.circle_services
  FOR DELETE USING (auth.uid() = provider_id);

-- Circle Resources RLS Policies
CREATE POLICY "Circle members can view resources" ON public.circle_resources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_resources.circle_id AND user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY "Circle members can upload resources" ON public.circle_resources
  FOR INSERT WITH CHECK (
    auth.uid() = uploader_id 
    AND EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_resources.circle_id AND user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY "Uploaders can delete resources" ON public.circle_resources
  FOR DELETE USING (auth.uid() = uploader_id);

-- Circle Tips RLS Policies
CREATE POLICY "Users can view tips" ON public.circle_tips
  FOR SELECT USING (auth.uid() = tipper_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send tips" ON public.circle_tips
  FOR INSERT WITH CHECK (auth.uid() = tipper_id);

-- Phase 5: Triggers and Functions

-- Function to create circle stats
CREATE OR REPLACE FUNCTION public.create_circle_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.circle_stats (circle_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger to auto-create circle stats
CREATE TRIGGER on_circle_created
  AFTER INSERT ON public.circles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_circle_stats();

-- Function to update member count
CREATE OR REPLACE FUNCTION public.update_circle_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'active') THEN
    UPDATE public.circle_stats
    SET members_count = members_count + 1
    WHERE circle_id = NEW.circle_id;
  ELSIF (TG_OP = 'DELETE' AND OLD.status = 'active') THEN
    UPDATE public.circle_stats
    SET members_count = members_count - 1
    WHERE circle_id = OLD.circle_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status != 'active') THEN
    UPDATE public.circle_stats
    SET members_count = members_count - 1
    WHERE circle_id = NEW.circle_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.status != 'active' AND NEW.status = 'active') THEN
    UPDATE public.circle_stats
    SET members_count = members_count + 1
    WHERE circle_id = NEW.circle_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to update member count
CREATE TRIGGER on_circle_member_change
  AFTER INSERT OR DELETE OR UPDATE ON public.circle_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_circle_member_count();

-- Function to update circle post count
CREATE OR REPLACE FUNCTION public.update_circle_post_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.circle_id IS NOT NULL) THEN
    UPDATE public.circle_stats
    SET posts_count = posts_count + 1
    WHERE circle_id = NEW.circle_id;
  ELSIF (TG_OP = 'DELETE' AND OLD.circle_id IS NOT NULL) THEN
    UPDATE public.circle_stats
    SET posts_count = posts_count - 1
    WHERE circle_id = OLD.circle_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.circle_id IS NULL AND NEW.circle_id IS NOT NULL) THEN
    UPDATE public.circle_stats
    SET posts_count = posts_count + 1
    WHERE circle_id = NEW.circle_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.circle_id IS NOT NULL AND NEW.circle_id IS NULL) THEN
    UPDATE public.circle_stats
    SET posts_count = posts_count - 1
    WHERE circle_id = OLD.circle_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.circle_id IS NOT NULL AND NEW.circle_id IS NOT NULL AND OLD.circle_id != NEW.circle_id) THEN
    UPDATE public.circle_stats
    SET posts_count = posts_count - 1
    WHERE circle_id = OLD.circle_id;
    UPDATE public.circle_stats
    SET posts_count = posts_count + 1
    WHERE circle_id = NEW.circle_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to update post count
CREATE TRIGGER on_circle_post_change
  AFTER INSERT OR DELETE OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_circle_post_count();

-- Function to get circle feed
CREATE OR REPLACE FUNCTION public.get_circle_feed(_circle_id UUID, page_num INTEGER DEFAULT 0, page_size INTEGER DEFAULT 10)
RETURNS TABLE(
  post_id UUID,
  content TEXT,
  media_url TEXT,
  media_urls TEXT[],
  media_alt TEXT,
  media_color_from TEXT,
  media_color_to TEXT,
  tags TEXT[],
  is_sponsored BOOLEAN,
  created_at TIMESTAMPTZ,
  user_id UUID,
  username TEXT,
  name TEXT,
  initials TEXT,
  avatar_url TEXT,
  avatar_color TEXT,
  is_verified BOOLEAN,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  saves_count INTEGER,
  user_has_liked BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id as post_id,
    p.content,
    p.media_url,
    p.media_urls,
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
    EXISTS(
      SELECT 1 FROM public.likes l
      WHERE l.post_id = p.id AND l.user_id = auth.uid()
    ) as user_has_liked
  FROM public.posts p
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  INNER JOIN public.post_stats ps ON p.id = ps.post_id
  WHERE p.circle_id = _circle_id
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET page_num * page_size;
$$;

-- Phase 6: Storage Buckets

-- Create circle-avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'circle-avatars',
  'circle-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create circle-covers bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'circle-covers',
  'circle-covers',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create circle-resources bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'circle-resources',
  'circle-resources',
  false,
  104857600,
  ARRAY['application/pdf', 'video/mp4', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for circle-avatars
CREATE POLICY "Circle avatars are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'circle-avatars');

CREATE POLICY "Authenticated users can upload circle avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'circle-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update circle avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'circle-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete circle avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'circle-avatars' AND auth.role() = 'authenticated');

-- Storage RLS Policies for circle-covers
CREATE POLICY "Circle covers are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'circle-covers');

CREATE POLICY "Authenticated users can upload circle covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'circle-covers' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update circle covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'circle-covers' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete circle covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'circle-covers' AND auth.role() = 'authenticated');

-- Storage RLS Policies for circle-resources
CREATE POLICY "Circle members can view resources"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'circle-resources' AND auth.role() = 'authenticated');

CREATE POLICY "Circle members can upload resources"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'circle-resources' AND auth.role() = 'authenticated');

CREATE POLICY "Uploaders can delete resources"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'circle-resources' AND auth.role() = 'authenticated');