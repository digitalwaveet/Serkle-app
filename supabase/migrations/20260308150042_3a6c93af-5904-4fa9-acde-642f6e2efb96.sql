
ALTER TABLE public.circle_members DROP CONSTRAINT circle_members_role_check;
ALTER TABLE public.circle_members ADD CONSTRAINT circle_members_role_check CHECK (role = ANY (ARRAY['creator'::text, 'admin'::text, 'moderator'::text, 'member'::text]));
