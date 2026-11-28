ALTER TABLE public.chapa_payment_intents
  ADD COLUMN checkout_return_seen_at timestamptz,
  ADD COLUMN provider_outcome text CHECK (provider_outcome IN ('success','pending','processing','failed','cancelled','canceled','refunded','reversed')),
  ADD COLUMN review_sent_at timestamptz,
  ADD COLUMN review_sent_status text CHECK (review_sent_status IN ('pending','failed'));

CREATE INDEX wallet_admin_review_payment
  ON public.wallet_payment_events(payment_id, created_at DESC, id DESC)
  WHERE event_type = 'admin_review_sent';

-- A browser visit is a diagnostic signal only. It cannot settle a payment.
CREATE FUNCTION public.record_wallet_checkout_return(_reference text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  UPDATE public.chapa_payment_intents SET checkout_return_seen_at = statement_timestamp()
  WHERE tx_ref = _reference AND user_id = auth.uid() AND kind = 'topup' AND checkout_url IS NOT NULL
    AND checkout_return_seen_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.record_chapa_check(_evidence jsonb,_details jsonb,_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result jsonb; p chapa_payment_intents; outcome text := _details->>'providerOutcome';
BEGIN
  IF _source NOT IN ('user','webhook','scheduled','reconcile') THEN RAISE EXCEPTION 'Invalid check source'; END IF;
  PERFORM set_config('serkle.wallet_source',_source,true);
  SELECT * INTO p FROM chapa_payment_intents WHERE tx_ref=_evidence->>'_tx_ref' FOR UPDATE;
  IF p.kind='withdrawal' THEN result:=apply_wallet_withdrawal_check(_evidence,_details);
  ELSE result:=apply_chapa_verification(_evidence->>'_tx_ref',_evidence->>'_status',(_evidence->>'_amount')::integer,_evidence->>'_currency',_evidence->>'_mode',_evidence->>'_provider_reference',(_evidence->>'_provider_updated_at')::timestamptz); END IF;
  IF (result->>'verified_at')::timestamptz IS NOT DISTINCT FROM p.verified_at THEN
    INSERT INTO wallet_payment_events(payment_id,user_id,event_type,source,status,message)
      VALUES(p.id,p.user_id,'check_unchanged',_source,result->>'status','The previous confirmed settlement state was preserved.');
  END IF;
  UPDATE chapa_payment_intents SET check_lease_until=NULL,checkout_lease_until=NULL,provider_status=result->>'status',
    provider_outcome=CASE
      WHEN outcome IN ('success','pending','processing','failed','cancelled','canceled','refunded','reversed')
        AND provider_updated_at=(_evidence->>'_provider_updated_at')::timestamptz
        AND status=_evidence->>'_status' THEN outcome
      WHEN status IS DISTINCT FROM p.status THEN NULL ELSE provider_outcome END,
    review_required=COALESCE(review_code='withdrawal_state_conflict',false),
    review_code=CASE WHEN review_code='withdrawal_state_conflict' THEN review_code END,
    last_error=CASE WHEN review_code='withdrawal_state_conflict' THEN 'Provider status conflicts with a previous withdrawal settlement. This receipt needs review.' END,
    last_error_code=CASE WHEN review_code='withdrawal_state_conflict' THEN 'withdrawal_state_conflict' END,
    payment_method=COALESCE(NULLIF(left(_details->>'paymentMethod',80),''),payment_method),
    provider_fee=COALESCE(CASE WHEN (_details->>'fee') ~ '^\d+(\.\d{1,2})?$' THEN (_details->>'fee')::numeric END,provider_fee),
    next_check_at=now()+CASE WHEN restored_at IS NOT NULL OR reversed_at IS NOT NULL THEN interval '365 days'
      WHEN (kind='withdrawal' AND status='pending') OR (kind='topup' AND credited_at IS NULL AND status IN ('pending','failed') AND created_at>now()-interval '1 day') THEN interval '1 minute'
      ELSE interval '1 day' END WHERE tx_ref=_evidence->>'_tx_ref' RETURNING * INTO p;
  RETURN to_jsonb(p);
END;
$$;

CREATE FUNCTION public.audit_admin_payment_check(_actor uuid, _reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT COALESCE(public.has_role(_actor, 'super_admin'), false) THEN
    RAISE EXCEPTION 'Super admin access required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.admin_audit_log(admin_id,action,target_type,target_id,details)
    SELECT _actor,'payment_check_requested',p.kind,p.tx_ref,jsonb_build_object('mode',p.mode)
    FROM public.chapa_payment_intents p WHERE p.tx_ref = _reference;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002'; END IF;
END;
$$;

CREATE FUNCTION public.wallet_payment_needs_followup(p public.chapa_payment_intents, checked_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT p.review_required OR ((p.review_sent_at IS NULL OR p.review_sent_status IS DISTINCT FROM p.status) AND (p.status = 'failed'
    OR (p.status = 'pending' AND (p.last_error_code IS NOT NULL OR p.created_at <= checked_at - interval '30 minutes'))));
$$;

CREATE OR REPLACE FUNCTION public.get_admin_wallet_operations(
  _mode text, _status text DEFAULT 'all', _reference text DEFAULT NULL,
  _before_created_at timestamptz DEFAULT NULL, _before_id uuid DEFAULT NULL, _kind text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE checked_at timestamptz := statement_timestamp(); reference text := nullif(btrim(_reference), '');
BEGIN
  IF NOT COALESCE(public.has_role(auth.uid(), 'super_admin'), false) THEN
    RAISE EXCEPTION 'Super admin access required' USING ERRCODE = '42501';
  END IF;
  IF _mode IS NULL OR _mode NOT IN ('live','test') OR _status IS NULL
    OR _status NOT IN ('all','pending','failed','succeeded','refunded','reversed','needs_review')
    OR _kind IS NULL OR _kind NOT IN ('all','topup','withdrawal')
    OR length(reference)>160 OR (_before_created_at IS NULL) <> (_before_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid payment filters' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'checked_at', checked_at,
    'summary', (SELECT jsonb_build_object(
      'pending',count(*) FILTER (WHERE p.status='pending'),
      'failed',count(*) FILTER (WHERE p.status='failed'),
      'needs_review',count(*) FILTER (WHERE public.wallet_payment_needs_followup(p,checked_at)),
      'due',count(*) FILTER (WHERE p.status IN ('pending','failed') AND p.next_check_at<=checked_at
        AND p.reversed_at IS NULL AND (p.check_lease_until IS NULL OR p.check_lease_until<=checked_at)
        AND (p.checkout_lease_until IS NULL OR p.checkout_lease_until<=checked_at))
    ) FROM public.chapa_payment_intents p WHERE p.mode=_mode AND (_kind='all' OR p.kind=_kind)),
    'latest_run', (SELECT jsonb_build_object('started_at',r.started_at,'completed_at',r.completed_at,'checked',r.checked,'errors',r.errors)
      FROM public.wallet_reconciliation_runs r WHERE r.mode=_mode ORDER BY r.started_at DESC,r.id DESC LIMIT 1),
    'items', (SELECT COALESCE(jsonb_agg(to_jsonb(result) ORDER BY result.created_at DESC,result.id DESC),'[]'::jsonb) FROM (
      SELECT p.id,p.tx_ref,p.kind,p.amount,p.currency,p.status,p.created_at,p.verified_at,p.credited_at,p.reversed_at,
        p.reserved_at,p.restored_at,p.submitted_at,p.next_check_at,p.attempts,
        public.wallet_payment_needs_followup(p,checked_at) AS review_required,p.review_sent_at,(p.last_error IS NOT NULL) AS has_check_error
      FROM public.chapa_payment_intents p
      WHERE p.mode=_mode AND (_status='all' OR p.status=_status OR (_status='needs_review' AND public.wallet_payment_needs_followup(p,checked_at)))
        AND (_kind='all' OR p.kind=_kind) AND (reference IS NULL OR p.tx_ref=reference)
        AND (_before_created_at IS NULL OR (p.created_at,p.id)<(_before_created_at,_before_id))
      ORDER BY p.created_at DESC,p.id DESC LIMIT 26
    ) result)
  );
END;
$$;

CREATE FUNCTION public.get_admin_payment_diagnostics(_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE p public.chapa_payment_intents; reasons jsonb; latest_review jsonb;
BEGIN
  IF NOT COALESCE(public.has_role(auth.uid(), 'super_admin'), false) THEN
    RAISE EXCEPTION 'Super admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.chapa_payment_intents WHERE id=_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC,e.id DESC),'[]'::jsonb) INTO reasons FROM (
    SELECT id,created_at,event_type,source,status,details->>'errorCode' AS error_code
    FROM public.wallet_payment_events WHERE payment_id=p.id AND user_id=p.user_id
      AND event_type IN ('verified','check_error','checkout_ready','checkout_error','funds_restored','payout_submission_started')
    ORDER BY created_at DESC,id DESC LIMIT 15
  ) e;
  SELECT jsonb_build_object('message',message,'created_at',created_at,'reason',details->>'reason')
    INTO latest_review FROM public.wallet_payment_events
    WHERE payment_id=p.id AND user_id=p.user_id AND event_type='admin_review_sent' ORDER BY created_at DESC,id DESC LIMIT 1;
  RETURN jsonb_build_object(
    'status',p.status,'mode',p.mode,'kind',p.kind,'verified_at',p.verified_at,
    'checkout_state',p.checkout_state,'checkout_return_seen_at',p.checkout_return_seen_at,
    'provider_status',p.provider_status,'provider_outcome',p.provider_outcome,
    'provider_reference',p.provider_reference,'last_error_code',p.last_error_code,
    'review_code',p.review_code,'events',reasons,'latest_review',latest_review
  );
END;
$$;

CREATE FUNCTION public.send_wallet_payment_review(
  _payment_id uuid, _request_id uuid, _expected_status text,
  _reason text, _message text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); p public.chapa_payment_intents; existing public.wallet_payment_events;
  clean_message text := btrim(_message); sent_at timestamptz := statement_timestamp();
BEGIN
  IF NOT COALESCE(public.has_role(actor,'super_admin'),false) THEN
    RAISE EXCEPTION 'Super admin access required' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL OR _expected_status IS NULL OR _expected_status NOT IN ('pending','failed')
    OR _reason IS NULL OR _reason NOT IN ('provider_failed','provider_cancelled','provider_timeout','checkout_unconfirmed',
      'provider_unavailable','details_mismatch','wallet_processing','still_pending','unknown')
    OR clean_message IS NULL OR char_length(clean_message) NOT BETWEEN 10 AND 1500 THEN
    RAISE EXCEPTION 'Choose a reason and write a message of 10 to 1,500 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO p FROM public.chapa_payment_intents WHERE id=_payment_id FOR UPDATE;
  IF NOT FOUND OR p.mode<>'live' THEN RAISE EXCEPTION 'Live payment not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO existing FROM public.wallet_payment_events WHERE id=_request_id;
  IF FOUND THEN
    IF existing.payment_id<>p.id OR existing.event_type<>'admin_review_sent' OR existing.message IS DISTINCT FROM clean_message
      OR existing.details->>'reason' IS DISTINCT FROM _reason OR existing.status IS DISTINCT FROM _expected_status THEN
      RAISE EXCEPTION 'This review request has already been used' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('sent_at',existing.created_at);
  END IF;
  IF p.status IS DISTINCT FROM _expected_status OR p.credited_at IS NOT NULL OR p.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'The payment status changed. Refresh and review it again.' USING ERRCODE = '55000';
  END IF;
  INSERT INTO public.wallet_payment_events(id,payment_id,user_id,event_type,source,status,message,details,created_at)
    VALUES(_request_id,p.id,p.user_id,'admin_review_sent','admin',p.status,clean_message,jsonb_build_object('reason',_reason),sent_at);
  INSERT INTO public.push_notifications(user_id,notification_type,title,body,data,delivery_status)
    VALUES(p.user_id,'admin_payment_review','Serkle payment review',clean_message,
      jsonb_build_object('paymentId',p.id,'paymentReference',p.tx_ref,'reviewId',_request_id,'reason',_reason),'in_app_only');
  INSERT INTO public.admin_audit_log(admin_id,action,target_type,target_id,details)
    VALUES(actor,'payment_review_sent',p.kind,p.tx_ref,jsonb_build_object('payment_id',p.id,'review_id',_request_id,'reason',_reason,'status',p.status));
  UPDATE public.chapa_payment_intents SET review_sent_at=sent_at,review_sent_status=p.status WHERE id=p.id;
  RETURN jsonb_build_object('sent_at',sent_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wallet_payment_receipt(_payment_id uuid,_before_created_at timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE receipt jsonb; entries jsonb; timeline jsonb; latest_review jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF _limit IS NULL OR _limit<1 OR _limit>50 OR (_before_created_at IS NULL)<>(_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid timeline page'; END IF;
  SELECT to_jsonb(p)-'checkout_url'-'request_id'-'checkout_lease_until'-'check_lease_until'
    INTO receipt FROM public.chapa_payment_intents p WHERE id=_payment_id AND user_id=auth.uid();
  IF receipt IS NULL THEN RAISE EXCEPTION 'Payment receipt not found' USING ERRCODE='42501'; END IF;
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at,t.id) INTO entries FROM public.coin_transactions t WHERE user_id=auth.uid() AND reference_id=_payment_id;
  SELECT jsonb_agg(to_jsonb(e)-'user_id' ORDER BY e.created_at DESC,e.id DESC) INTO timeline FROM (
    SELECT * FROM public.wallet_payment_events WHERE payment_id=_payment_id AND user_id=auth.uid()
      AND (_before_created_at IS NULL OR (created_at,id)<(_before_created_at,_before_id))
    ORDER BY created_at DESC,id DESC LIMIT _limit+1
  ) e;
  SELECT jsonb_build_object('message',message,'created_at',created_at,'reason',details->>'reason')
    INTO latest_review FROM public.wallet_payment_events WHERE payment_id=_payment_id AND user_id=auth.uid()
      AND event_type='admin_review_sent' ORDER BY created_at DESC,id DESC LIMIT 1;
  RETURN jsonb_build_object('userId',auth.uid(),'payment',receipt,'ledger',COALESCE(entries,'[]'),'events',COALESCE(timeline,'[]'),'latestReview',latest_review);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wallet_payment_history(_before_created_at timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 20,_mode text DEFAULT 'all')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE rows jsonb; runs jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF _limit IS NULL OR _limit<1 OR _limit>50 OR _mode NOT IN ('all','live','test') OR (_before_created_at IS NULL)<>(_before_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid history page';
  END IF;
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC,p.id DESC) INTO rows FROM (
    SELECT id,tx_ref,kind,amount,currency,mode,status,checkout_state,created_at,verified_at,next_check_at,credited_at,reversed_at,
      reserved_at,restored_at,submitted_at,destination_hint,check_count,last_error,last_error_code,review_required,review_sent_at,
      provider_reference,provider_status,payment_method,provider_fee
    FROM public.chapa_payment_intents WHERE user_id=auth.uid() AND (_mode='all' OR mode=_mode)
      AND (_before_created_at IS NULL OR (created_at,id)<(_before_created_at,_before_id)) ORDER BY created_at DESC,id DESC LIMIT _limit+1
  ) p;
  SELECT jsonb_build_object('live',max(completed_at) FILTER(WHERE mode='live'),'test',max(completed_at) FILTER(WHERE mode='test'))
    INTO runs FROM public.wallet_reconciliation_runs;
  RETURN jsonb_build_object('userId',auth.uid(),'items',COALESCE(rows,'[]'),'automaticChecks',runs);
END;
$$;

REVOKE ALL ON FUNCTION public.record_wallet_checkout_return(text),public.get_admin_payment_diagnostics(uuid),
  public.send_wallet_payment_review(uuid,uuid,text,text,text),public.audit_admin_payment_check(uuid,text),
  public.wallet_payment_needs_followup(public.chapa_payment_intents,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_wallet_checkout_return(text),public.get_admin_payment_diagnostics(uuid),
  public.send_wallet_payment_review(uuid,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_admin_payment_check(uuid,text) TO service_role;

-- Recipients keep read and clear actions while message contents remain server-written.
REVOKE UPDATE ON public.push_notifications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (read_at) ON public.push_notifications TO authenticated;
NOTIFY pgrst, 'reload schema';
