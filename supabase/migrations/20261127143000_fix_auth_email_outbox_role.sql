-- PostgREST sets the active database role before calling the RPC. The legacy
-- per-claim JWT setting can be absent even on a service_role request.
CREATE OR REPLACE FUNCTION public.claim_auth_email_outbox(
  p_worker_id uuid,
  p_limit integer DEFAULT 4
)
RETURNS TABLE (
  id uuid,
  recipient text,
  subject text,
  html text,
  text_body text,
  message_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.auth_email_outbox AS expired
  SET status = 'failed',
      recipient = NULL,
      subject = NULL,
      html = NULL,
      text_body = NULL,
      message_id = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      last_error = 'Email delivery window expired.',
      updated_at = now()
  WHERE expired.status IN ('pending', 'sending')
    AND (expired.expires_at <= now() OR expired.attempts >= 5);

  RETURN QUERY
  WITH candidates AS (
    SELECT queued.id
    FROM public.auth_email_outbox AS queued
    WHERE queued.expires_at > now()
      AND queued.attempts < 5
      AND (
        (queued.status = 'pending' AND queued.available_at <= now())
        OR (queued.status = 'sending' AND queued.lease_expires_at < now())
      )
    ORDER BY queued.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 4), 10))
  ), claimed AS (
    UPDATE public.auth_email_outbox AS queued
    SET status = 'sending',
        attempts = queued.attempts + 1,
        lease_token = p_worker_id,
        lease_expires_at = now() + interval '2 minutes',
        updated_at = now()
    FROM candidates
    WHERE queued.id = candidates.id
    RETURNING queued.id, queued.recipient, queued.subject, queued.html,
      queued.text_body, queued.message_id
  )
  SELECT claimed.id, claimed.recipient, claimed.subject, claimed.html,
    claimed.text_body, claimed.message_id
  FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_auth_email_outbox(
  p_id uuid,
  p_worker_id uuid,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  IF p_error IS NULL THEN
    UPDATE public.auth_email_outbox AS queued
    SET status = 'sent',
        recipient = NULL,
        subject = NULL,
        html = NULL,
        text_body = NULL,
        message_id = NULL,
        sent_at = now(),
        last_error = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE queued.id = p_id
      AND queued.status = 'sending'
      AND queued.lease_token = p_worker_id;
  ELSE
    UPDATE public.auth_email_outbox AS queued
    SET status = CASE
          WHEN queued.attempts >= 5 OR queued.expires_at <= now() THEN 'failed'
          ELSE 'pending'
        END,
        available_at = now() + (
          LEAST(300, 10 * queued.attempts * queued.attempts)::text || ' seconds'
        )::interval,
        recipient = CASE WHEN queued.attempts >= 5 OR queued.expires_at <= now() THEN NULL ELSE queued.recipient END,
        subject = CASE WHEN queued.attempts >= 5 OR queued.expires_at <= now() THEN NULL ELSE queued.subject END,
        html = CASE WHEN queued.attempts >= 5 OR queued.expires_at <= now() THEN NULL ELSE queued.html END,
        text_body = CASE WHEN queued.attempts >= 5 OR queued.expires_at <= now() THEN NULL ELSE queued.text_body END,
        message_id = CASE WHEN queued.attempts >= 5 OR queued.expires_at <= now() THEN NULL ELSE queued.message_id END,
        last_error = left(COALESCE(p_error, 'SMTP delivery failed.'), 500),
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE queued.id = p_id
      AND queued.status = 'sending'
      AND queued.lease_token = p_worker_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_auth_email_outbox(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_auth_email_outbox(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_auth_email_outbox(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_auth_email_outbox(uuid, uuid, text) TO service_role;
