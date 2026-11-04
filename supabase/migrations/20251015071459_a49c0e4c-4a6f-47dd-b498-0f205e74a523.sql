-- Fix search_path for existing functions to improve security

-- Update create_profile_stats function
CREATE OR REPLACE FUNCTION public.create_profile_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profile_stats (user_id)
  VALUES (new.id);
  RETURN new;
END;
$function$;

-- Update create_post_stats function
CREATE OR REPLACE FUNCTION public.create_post_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.post_stats (post_id)
  VALUES (new.id);
  RETURN new;
END;
$function$;

-- Update update_post_likes_count function
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.post_stats
    SET likes_count = likes_count + 1
    WHERE post_id = new.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.post_stats
    SET likes_count = likes_count - 1
    WHERE post_id = old.post_id;
  END IF;
  RETURN NULL;
END;
$function$;

-- Update create_video_stats function
CREATE OR REPLACE FUNCTION public.create_video_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.video_stats (video_id)
  VALUES (new.id);
  RETURN new;
END;
$function$;

-- Update update_post_comments_count function
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.post_stats
    SET comments_count = comments_count + 1
    WHERE post_id = new.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.post_stats
    SET comments_count = comments_count - 1
    WHERE post_id = old.post_id;
  END IF;
  RETURN NULL;
END;
$function$;