-- Drop existing function and recreate with media_urls
DROP FUNCTION IF EXISTS public.get_feed_posts(integer, integer);

CREATE OR REPLACE FUNCTION public.get_feed_posts(page_num integer DEFAULT 0, page_size integer DEFAULT 10)
 RETURNS TABLE(post_id uuid, content text, media_url text, media_urls text[], media_alt text, media_color_from text, media_color_to text, tags text[], is_sponsored boolean, created_at timestamp with time zone, user_id uuid, username text, name text, initials text, avatar_url text, avatar_color text, is_verified boolean, likes_count integer, comments_count integer, shares_count integer, saves_count integer, user_has_liked boolean)
 LANGUAGE sql
 STABLE
AS $function$
  select
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
$function$;