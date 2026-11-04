-- Fix remaining functions with search_path issues

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _username text;
  _name text;
  _initials text;
BEGIN
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
  
  IF length(_initials) < 2 THEN
    _initials := upper(left(_name, 2));
  END IF;

  INSERT INTO public.profiles (
    id,
    username,
    name,
    email,
    initials,
    avatar_color
  ) VALUES (
    new.id,
    _username,
    _name,
    new.email,
    _initials,
    '#' || substring(md5(new.id::text), 1, 6)
  );
  
  RETURN new;
END;
$function$;