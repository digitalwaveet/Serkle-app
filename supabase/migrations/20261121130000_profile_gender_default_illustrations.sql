-- Persist an explicit signup choice so a deterministic profile illustration can
-- be shown everywhere until the member uploads a photo. Existing uploaded and
-- OAuth avatars always take precedence.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text;

DO $migration$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_gender_check
    CHECK (gender IS NULL OR gender IN ('female', 'male'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

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
  _gender text;
  _avatar_url text;
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

  _gender := CASE lower(new.raw_user_meta_data->>'gender')
    WHEN 'female' THEN 'female'
    WHEN 'male' THEN 'male'
    ELSE NULL
  END;

  _avatar_url := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'picture', ''),
    CASE _gender
      WHEN 'female' THEN '/illustrations/profile-female.svg'
      WHEN 'male' THEN '/illustrations/profile-male.svg'
      ELSE NULL
    END
  );

  INSERT INTO public.profiles (
    id,
    username,
    name,
    email,
    phone,
    initials,
    avatar_color,
    avatar_url,
    gender
  ) VALUES (
    new.id,
    _username,
    _name,
    coalesce(new.email, ''),
    nullif(new.phone, ''),
    _initials,
    '#' || substring(md5(new.id::text), 1, 6),
    _avatar_url,
    _gender
  );

  RETURN new;
END;
$function$;

-- Repair only accounts that already contain an explicit supported gender in
-- auth metadata. Never infer gender or replace an existing profile photo.
UPDATE public.profiles AS profile
SET
  gender = lower(auth_user.raw_user_meta_data->>'gender'),
  avatar_url = coalesce(
    profile.avatar_url,
    nullif(auth_user.raw_user_meta_data->>'avatar_url', ''),
    nullif(auth_user.raw_user_meta_data->>'picture', ''),
    CASE lower(auth_user.raw_user_meta_data->>'gender')
      WHEN 'female' THEN '/illustrations/profile-female.svg'
      WHEN 'male' THEN '/illustrations/profile-male.svg'
    END
  ),
  updated_at = now()
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND lower(auth_user.raw_user_meta_data->>'gender') IN ('female', 'male')
  AND (
    profile.gender IS DISTINCT FROM lower(auth_user.raw_user_meta_data->>'gender')
    OR profile.avatar_url IS NULL
  );
