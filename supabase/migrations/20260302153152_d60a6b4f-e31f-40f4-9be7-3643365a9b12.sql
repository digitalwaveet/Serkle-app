CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _username text;
  _name text;
  _initials text;
  _email text;
BEGIN
  _name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    CASE WHEN new.email IS NOT NULL AND new.email != '' THEN split_part(new.email, '@', 1) ELSE NULL END,
    CASE WHEN new.phone IS NOT NULL AND new.phone != '' THEN 'user_' || right(new.phone, 4) ELSE NULL END,
    'user'
  );
  
  _username := CASE 
    WHEN new.email IS NOT NULL AND new.email != '' THEN lower(split_part(new.email, '@', 1))
    WHEN new.phone IS NOT NULL AND new.phone != '' THEN 'phone_' || right(new.phone, 4)
    ELSE 'user'
  END || '_' || substr(new.id::text, 1, 4);
  
  _email := coalesce(new.email, new.phone, '');
  
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
    _email,
    _initials,
    '#' || substring(md5(new.id::text), 1, 6)
  );
  
  RETURN new;
END;
$function$;