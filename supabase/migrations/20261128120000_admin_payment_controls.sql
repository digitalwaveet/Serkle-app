CREATE TABLE IF NOT EXISTS public.chapa_runtime_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  mode text CHECK (mode IN ('test', 'live'))
);
ALTER TABLE public.chapa_runtime_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chapa_runtime_settings FROM PUBLIC, anon, authenticated;
INSERT INTO public.chapa_runtime_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_chapa_mode_override()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT mode FROM public.chapa_runtime_settings WHERE singleton $$;

CREATE OR REPLACE FUNCTION public.set_chapa_mode_override(_actor uuid, _mode text, _expected text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT COALESCE(public.has_role(_actor, 'super_admin'), false) THEN
    RAISE EXCEPTION 'Super admin access required' USING ERRCODE = '42501';
  END IF;
  IF _mode IS NULL OR _mode NOT IN ('live', 'test') THEN
    RAISE EXCEPTION 'Invalid payment mode' USING ERRCODE = '22023';
  END IF;
  UPDATE public.chapa_runtime_settings SET mode = _mode
    WHERE singleton AND mode IS NOT DISTINCT FROM _expected AND mode IS DISTINCT FROM _mode;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment mode already changed' USING ERRCODE = '55000'; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (_actor, 'chapa_mode_changed', 'payment_settings', 'chapa', jsonb_build_object('mode', _mode, 'previous_override', _expected));
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_admin_withdrawal_check(_actor uuid, _reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT COALESCE(public.has_role(_actor, 'super_admin'), false) THEN
    RAISE EXCEPTION 'Super admin access required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    SELECT _actor, 'withdrawal_check_requested', 'withdrawal', p.tx_ref, jsonb_build_object('mode', p.mode)
    FROM public.chapa_payment_intents p WHERE p.tx_ref = _reference AND p.kind = 'withdrawal';
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found' USING ERRCODE = 'P0002'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_chapa_mode_override(), public.set_chapa_mode_override(uuid, text, text),
  public.audit_admin_withdrawal_check(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chapa_mode_override(), public.set_chapa_mode_override(uuid, text, text),
  public.audit_admin_withdrawal_check(uuid, text) TO service_role;

-- Remove the obsolete signature so the optional type filter does not make RPC
-- resolution ambiguous for dashboard clients using the original arguments.
DROP FUNCTION IF EXISTS public.get_admin_wallet_operations(text, text, text, timestamptz, uuid);
CREATE OR REPLACE FUNCTION public.get_admin_wallet_operations(
  _mode text, _status text DEFAULT 'all', _reference text DEFAULT NULL,
  _before_created_at timestamptz DEFAULT NULL, _before_id uuid DEFAULT NULL, _kind text DEFAULT 'all'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  checked_at timestamptz := statement_timestamp();
  reference text := nullif(btrim(_reference), '');
BEGIN
  IF NOT COALESCE(public.has_role(auth.uid(), 'super_admin'), false) THEN
    RAISE EXCEPTION 'Super admin access required' USING ERRCODE = '42501';
  END IF;
  IF _mode IS NULL OR _mode NOT IN ('live', 'test') OR _status IS NULL
     OR _status NOT IN ('all', 'pending', 'failed', 'succeeded', 'refunded', 'reversed')
     OR _kind IS NULL OR _kind NOT IN ('all', 'topup', 'withdrawal')
     OR length(reference) > 160 OR (_before_created_at IS NULL) <> (_before_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid payment filters' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'checked_at', checked_at,
    'summary', (SELECT jsonb_build_object(
      'pending', count(*) FILTER (WHERE p.status = 'pending'),
      'failed', count(*) FILTER (WHERE p.status = 'failed'),
      'due', count(*) FILTER (WHERE p.status IN ('pending', 'failed')
        AND p.next_check_at <= checked_at AND p.reversed_at IS NULL
        AND (p.check_lease_until IS NULL OR p.check_lease_until <= checked_at)
        AND (p.checkout_lease_until IS NULL OR p.checkout_lease_until <= checked_at))
    ) FROM public.chapa_payment_intents p WHERE p.mode = _mode AND (_kind = 'all' OR p.kind = _kind)),
    'latest_run', (SELECT jsonb_build_object('started_at', r.started_at, 'completed_at', r.completed_at,
      'checked', r.checked, 'errors', r.errors)
      FROM public.wallet_reconciliation_runs r WHERE r.mode = _mode ORDER BY r.started_at DESC, r.id DESC LIMIT 1),
    'items', (SELECT COALESCE(jsonb_agg(to_jsonb(result) ORDER BY result.created_at DESC, result.id DESC), '[]'::jsonb)
      FROM (
        SELECT p.id, p.tx_ref, p.kind, p.amount, p.currency, p.status, p.created_at, p.verified_at,
          p.credited_at, p.reversed_at, p.reserved_at, p.restored_at, p.submitted_at,
          p.next_check_at, p.attempts, p.review_required, (p.last_error IS NOT NULL) AS has_check_error
        FROM public.chapa_payment_intents p
        WHERE p.mode = _mode AND (_status = 'all' OR p.status = _status) AND (_kind = 'all' OR p.kind = _kind)
          AND (reference IS NULL OR p.tx_ref = reference)
          AND (_before_created_at IS NULL OR (p.created_at, p.id) < (_before_created_at, _before_id))
        ORDER BY p.created_at DESC, p.id DESC LIMIT 26
      ) result)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_wallet_operations(text, text, text, timestamptz, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_wallet_operations(text, text, text, timestamptz, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
