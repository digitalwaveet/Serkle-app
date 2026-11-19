-- Keep email and phone identities in their correct profile columns.
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
BEGIN
  _name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    CASE WHEN nullif(new.email, '') IS NOT NULL THEN split_part(new.email, '@', 1) END,
    CASE WHEN nullif(new.phone, '') IS NOT NULL THEN 'user_' || right(new.phone, 4) END,
    'user'
  );

  _username := CASE
    WHEN nullif(new.email, '') IS NOT NULL THEN lower(split_part(new.email, '@', 1))
    WHEN nullif(new.phone, '') IS NOT NULL THEN 'phone_' || right(new.phone, 4)
    ELSE 'user'
  END || '_' || substr(new.id::text, 1, 4);

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
    phone,
    initials,
    avatar_color
  ) VALUES (
    new.id,
    _username,
    _name,
    coalesce(new.email, ''),
    nullif(new.phone, ''),
    _initials,
    '#' || substring(md5(new.id::text), 1, 6)
  );

  RETURN new;
END;
$function$;

-- Repair phone-auth profiles created by the previous trigger. Preserve any
-- separately supplied profile email, while moving misplaced phone identities.
UPDATE public.profiles AS profile
SET
  phone = auth_user.phone,
  email = CASE
    WHEN profile.email = auth_user.phone THEN ''
    ELSE profile.email
  END,
  updated_at = now()
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND nullif(auth_user.phone, '') IS NOT NULL
  AND profile.phone IS DISTINCT FROM auth_user.phone;

