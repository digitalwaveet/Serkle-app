-- Reliable database-to-Web-Push delivery.
--
-- The migrated project rejected the legacy anon JWT used by the old trigger,
-- returning UNAUTHORIZED_LEGACY_JWT for every notification. Delivery-only
-- calls now use an unguessable notification UUID and the Edge handler reads
-- all content/recipients from the database. User-authored producer calls are
-- still authenticated inside the function.

ALTER TABLE public.push_notifications
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delivery_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_delivery_error text,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.push_notifications'::regclass
      AND conname = 'push_notifications_delivery_status_check'
  ) THEN
    ALTER TABLE public.push_notifications
      ADD CONSTRAINT push_notifications_delivery_status_check
      CHECK (delivery_status IN (
        'pending', 'processing', 'delivered', 'failed',
        'failed_permanent', 'no_subscription', 'expired'
      ));
  END IF;
END;
$$;

-- Never flood users with the backlog created while delivery authentication
-- was broken. Rows remain visible in notification history; only stale push
-- delivery is retired.
UPDATE public.push_notifications
SET delivery_status = CASE WHEN delivered_at IS NULL THEN 'expired' ELSE 'delivered' END,
    last_delivery_error = CASE
      WHEN delivered_at IS NULL THEN 'Expired during reliable push delivery migration'
      ELSE NULL
    END
WHERE delivery_status = 'pending'
  AND delivery_attempts = 0;

CREATE INDEX IF NOT EXISTS idx_push_notifications_delivery_queue
  ON public.push_notifications (delivery_status, next_attempt_at, created_at)
  WHERE delivered_at IS NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS expiration_time timestamptz,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.deliver_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fkeyentcklsuqecqgmak.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('notification_id', NEW.id),
    timeout_milliseconds := 10000
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_push_notification_created ON public.push_notifications;
CREATE TRIGGER on_push_notification_created
  AFTER INSERT ON public.push_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.deliver_push_notification();

CREATE OR REPLACE FUNCTION public.retry_push_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  queued integer := 0;
BEGIN
  -- Recover a worker that stopped after claiming a row.
  UPDATE public.push_notifications
  SET delivery_status = CASE WHEN delivery_attempts >= 5 THEN 'failed_permanent' ELSE 'failed' END,
      last_delivery_error = COALESCE(last_delivery_error, 'Delivery worker timed out'),
      next_attempt_at = CASE WHEN delivery_attempts >= 5 THEN NULL ELSE now() END
  WHERE delivery_status = 'processing'
    AND last_delivery_attempt_at < now() - interval '2 minutes';

  WITH retryable AS (
    SELECT id
    FROM public.push_notifications
    WHERE delivery_status IN ('pending', 'failed')
      AND delivery_attempts < 5
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
    ORDER BY created_at
    LIMIT 25
  ), requests AS (
    SELECT net.http_post(
      url := 'https://fkeyentcklsuqecqgmak.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('notification_id', retryable.id),
      timeout_milliseconds := 10000
    )
    FROM retryable
  )
  SELECT count(*)::integer INTO queued FROM requests;

  RETURN queued;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_push_notifications() FROM PUBLIC;

DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'retry-push-notifications';
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
  PERFORM cron.schedule(
    'retry-push-notifications',
    '* * * * *',
    'select public.retry_push_notifications();'
  );
END;
$$;
