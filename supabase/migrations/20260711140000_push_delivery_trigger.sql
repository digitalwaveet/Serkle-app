-- Database-driven push delivery
-- ---------------------------------------------------------------------------
-- Inserting a row into push_notifications is now the ONE way to notify a user:
-- this trigger calls the send-push-notification edge function (deliver-only
-- mode), which claims the row via delivered_at and sends Web Push to all of
-- the user's saved subscriptions. Producers — client code, RPCs like
-- respond_circle_join_request, other edge functions — just insert rows.

-- 1. Idempotency column: the edge function atomically claims a row before
--    delivering, so duplicate trigger fires or replayed calls send nothing.
ALTER TABLE public.push_notifications
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 2. Async HTTP from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Trigger: POST the new row's id to the edge function.
--    The anon key below is the project's public client key (already shipped in
--    the app bundle) — it only gets this request past the gateway's JWT check.
--    Content comes from the row itself, never from the request. If you rotate
--    the anon key, re-run CREATE OR REPLACE with the new value.
CREATE OR REPLACE FUNCTION public.deliver_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://zewcewkqruxlniavsrgj.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpld2Nld2txcnV4bG5pYXZzcmdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMTE3ODMsImV4cCI6MjA4Njg4Nzc4M30.3NnWsvlcgKyAFexh1NrFjKf5ks-_REeVWLgC7TJxU2k'
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_push_notification_created ON public.push_notifications;
CREATE TRIGGER on_push_notification_created
  AFTER INSERT ON public.push_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.deliver_push_notification();
