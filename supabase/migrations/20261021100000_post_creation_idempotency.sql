-- Give each submitted composer draft a stable key so a retry after a lost
-- network response returns the original post instead of creating another.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS posts_user_client_request_id_uidx
  ON public.posts (user_id, client_request_id);

NOTIFY pgrst, 'reload schema';
