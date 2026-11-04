-- Fix remaining functions with search_path issues

-- Update update_video_likes_count function
CREATE OR REPLACE FUNCTION public.update_video_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.video_stats
    SET likes_count = likes_count + 1
    WHERE video_id = NEW.video_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.video_stats
    SET likes_count = likes_count - 1
    WHERE video_id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$function$;

-- Update update_video_comments_count function
CREATE OR REPLACE FUNCTION public.update_video_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.video_stats
    SET comments_count = comments_count + 1
    WHERE video_id = NEW.video_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.video_stats
    SET comments_count = comments_count - 1
    WHERE video_id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$function$;

-- Update update_follow_counts function
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.profile_stats
    SET following_count = following_count + 1
    WHERE user_id = new.follower_id;
    
    UPDATE public.profile_stats
    SET followers_count = followers_count + 1
    WHERE user_id = new.following_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.profile_stats
    SET following_count = following_count - 1
    WHERE user_id = old.follower_id;
    
    UPDATE public.profile_stats
    SET followers_count = followers_count - 1
    WHERE user_id = old.following_id;
  END IF;
  RETURN NULL;
END;
$function$;

-- Update update_video_saves_count function
CREATE OR REPLACE FUNCTION public.update_video_saves_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.video_stats
    SET saves_count = saves_count + 1
    WHERE video_id = NEW.video_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.video_stats
    SET saves_count = saves_count - 1
    WHERE video_id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$function$;

-- Update update_profile_video_count function
CREATE OR REPLACE FUNCTION public.update_profile_video_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.profile_stats
    SET videos_count = videos_count + 1
    WHERE user_id = NEW.user_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.profile_stats
    SET videos_count = videos_count - 1
    WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$function$;