ALTER TABLE public.profiles
  ADD COLUMN is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN hide_followers boolean NOT NULL DEFAULT false,
  ADD COLUMN hide_online_status boolean NOT NULL DEFAULT false,
  ADD COLUMN allow_messages_from text NOT NULL DEFAULT 'everyone';