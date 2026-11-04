-- Migration to add phone and birthday to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday date;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.phone IS 'User phone number';
COMMENT ON COLUMN public.profiles.birthday IS 'User date of birth';
