-- Fix search_path for existing functions with CASCADE to handle dependencies

-- Fix is_circle_member function (with CASCADE)
DROP FUNCTION IF EXISTS public.is_circle_member(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_circle_member(_circle_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members
    WHERE circle_id = _circle_id
      AND user_id = _user_id
      AND status = 'active'
  );
$$;

-- Fix has_circle_subscription function (with CASCADE)
DROP FUNCTION IF EXISTS public.has_circle_subscription(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.has_circle_subscription(_circle_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_subscriptions
    WHERE circle_id = _circle_id
      AND user_id = _user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Recreate the dropped RLS policies that depended on is_circle_member
CREATE POLICY "Public circles viewable by everyone"
ON public.circles
FOR SELECT
USING ((NOT is_private) OR is_circle_member(id, auth.uid()) OR (creator_id = auth.uid()));

CREATE POLICY "Members viewable by members or public circles"
ON public.circle_members
FOR SELECT
USING ((EXISTS ( SELECT 1
   FROM circles
  WHERE ((circles.id = circle_members.circle_id) AND (NOT circles.is_private)))) OR is_circle_member(circle_id, auth.uid()));

-- Recreate policy that depends on has_circle_subscription
CREATE POLICY "posts_select_policy"
ON public.posts
FOR SELECT
USING ((NOT is_premium) OR (auth.uid() = user_id) OR ((circle_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM circles
  WHERE ((circles.id = posts.circle_id) AND (circles.creator_id = auth.uid())))) OR has_circle_subscription(circle_id, auth.uid()))));