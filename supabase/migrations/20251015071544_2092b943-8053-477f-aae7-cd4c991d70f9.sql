-- Fix remaining SQL functions with search_path issues

-- Update get_post_comments function
CREATE OR REPLACE FUNCTION public.get_post_comments(_post_id uuid)
RETURNS TABLE(
  comment_id uuid,
  content text,
  created_at timestamp with time zone,
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
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
    EXISTS(
      SELECT 1 FROM public.comment_likes cl2
      WHERE cl2.comment_id = c.id
      AND cl2.user_id = auth.uid()
    ) as user_has_liked
  FROM public.comments c
  INNER JOIN public.profiles prof ON c.user_id = prof.id
  LEFT JOIN public.comment_likes cl ON c.id = cl.comment_id
  WHERE c.post_id = _post_id
  GROUP BY c.id, prof.id
  ORDER BY c.created_at ASC;
$function$;

-- Update get_video_comments function
CREATE OR REPLACE FUNCTION public.get_video_comments(_video_id uuid)
RETURNS TABLE(
  comment_id uuid,
  content text,
  created_at timestamp with time zone,
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    vc.id as comment_id,
    vc.content,
    vc.created_at,
    vc.parent_id,
    prof.id as user_id,
    prof.username,
    prof.name,
    prof.initials,
    prof.avatar_url,
    prof.avatar_color,
    COUNT(vcl.id) as likes_count,
    EXISTS(
      SELECT 1 FROM public.video_comment_likes vcl2
      WHERE vcl2.comment_id = vc.id AND vcl2.user_id = auth.uid()
    ) as user_has_liked
  FROM public.video_comments vc
  INNER JOIN public.profiles prof ON vc.user_id = prof.id
  LEFT JOIN public.video_comment_likes vcl ON vc.id = vcl.comment_id
  WHERE vc.video_id = _video_id
  GROUP BY vc.id, prof.id
  ORDER BY vc.created_at ASC;
$function$;