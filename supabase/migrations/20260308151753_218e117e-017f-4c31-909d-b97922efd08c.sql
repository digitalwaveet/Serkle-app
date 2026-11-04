
-- Add invite_code column to circles
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- Generate invite codes for existing circles
UPDATE public.circles SET invite_code = substr(md5(id::text || random()::text), 1, 10) WHERE invite_code IS NULL;

-- Make it NOT NULL with a default
ALTER TABLE public.circles ALTER COLUMN invite_code SET DEFAULT substr(md5(gen_random_uuid()::text), 1, 10);
ALTER TABLE public.circles ALTER COLUMN invite_code SET NOT NULL;

-- Create function to auto-generate invite code on insert
CREATE OR REPLACE FUNCTION public.generate_circle_invite_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := substr(md5(NEW.id::text || random()::text || now()::text), 1, 10);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_circle_invite_code
  BEFORE INSERT ON public.circles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_circle_invite_code();
