-- Durable receipts and an append-only audit trail. Test receipts never fund
-- the live wallet. Existing balances and legacy ledger entries are preserved.
ALTER TABLE public.chapa_payment_intents
  ADD COLUMN checkout_state text NOT NULL DEFAULT 'not_confirmed' CHECK(checkout_state IN ('not_confirmed','processing','ready','error')),
  ADD COLUMN checkout_lease_until timestamptz,
  ADD COLUMN check_lease_until timestamptz,
  ADD COLUMN check_started_at timestamptz,
  ADD COLUMN check_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_error_code text,
  ADD COLUMN review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN review_code text,
  ADD COLUMN provider_status text,
  ADD COLUMN payment_method text,
  ADD COLUMN provider_fee numeric(18,2) CHECK(provider_fee>=0);
UPDATE chapa_payment_intents SET checkout_state=CASE WHEN checkout_url IS NULL THEN 'not_confirmed' ELSE 'ready' END,
  check_count=attempts,provider_status=CASE WHEN verified_at IS NOT NULL THEN status END;
CREATE INDEX chapa_owner_history ON chapa_payment_intents(user_id,created_at DESC,id DESC);
CREATE INDEX wallet_owner_activity ON coin_transactions(user_id,created_at DESC,id DESC);

CREATE TABLE public.wallet_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES chapa_payment_intents(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  event_type text NOT NULL,
  source text NOT NULL,
  previous_status text,
  status text NOT NULL,
  message text,
  details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object' AND octet_length(details::text)<=8192),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_receipt_timeline ON wallet_payment_events(payment_id,created_at,id);
ALTER TABLE wallet_payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallet_events_owner_read ON wallet_payment_events FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON wallet_payment_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON wallet_payment_events TO authenticated,service_role;

CREATE FUNCTION public.wallet_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Wallet audit events cannot be edited or deleted' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER wallet_event_immutable BEFORE UPDATE OR DELETE ON wallet_payment_events
  FOR EACH ROW EXECUTE FUNCTION wallet_event_immutable();

CREATE FUNCTION public.audit_chapa_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event text; prior text; origin text:=COALESCE(NULLIF(current_setting('serkle.wallet_source',true),''),'server');
BEGIN
  IF TG_OP='INSERT' THEN event:='created';
  ELSE
    prior:=OLD.status;
    IF to_jsonb(NEW)->'reserved_at' IS DISTINCT FROM to_jsonb(OLD)->'reserved_at' THEN event:='funds_reserved';
    ELSIF to_jsonb(NEW)->'restored_at' IS DISTINCT FROM to_jsonb(OLD)->'restored_at' THEN event:='funds_restored';
    ELSIF to_jsonb(NEW)->'submitted_at' IS DISTINCT FROM to_jsonb(OLD)->'submitted_at' THEN event:='payout_submission_started';
    ELSIF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN event:='verified';
    ELSIF NEW.check_count<>OLD.check_count THEN event:='check_started';
    ELSIF NEW.last_error IS NOT NULL AND (NEW.last_error IS DISTINCT FROM OLD.last_error OR NEW.check_lease_until IS DISTINCT FROM OLD.check_lease_until OR NEW.last_error_code IS DISTINCT FROM OLD.last_error_code) THEN event:='check_error';
    ELSIF NEW.checkout_state IS DISTINCT FROM OLD.checkout_state THEN event:='checkout_'||NEW.checkout_state;
    ELSIF NEW.review_required IS DISTINCT FROM OLD.review_required THEN event:=CASE WHEN NEW.review_required THEN 'review_required' ELSE 'review_resolved' END;
    ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.credited_at IS DISTINCT FROM OLD.credited_at OR NEW.reversed_at IS DISTINCT FROM OLD.reversed_at THEN event:='status_changed';
    ELSE RETURN NEW;
    END IF;
  END IF;
  INSERT INTO wallet_payment_events(payment_id,user_id,event_type,source,previous_status,status,message,details)
    VALUES(NEW.id,NEW.user_id,event,origin,prior,NEW.status,left(NEW.last_error,250),
      jsonb_strip_nulls(jsonb_build_object('mode',NEW.mode,'amount',NEW.amount,'currency',NEW.currency,
        'providerReference',NEW.provider_reference,'providerStatus',CASE WHEN event='verified' THEN NEW.status ELSE NEW.provider_status END,'errorCode',NEW.last_error_code,
        'creditedAt',NEW.credited_at,'reversedAt',NEW.reversed_at,'reviewRequired',NEW.review_required,
        'kind',to_jsonb(NEW)->>'kind','reservedAt',to_jsonb(NEW)->>'reserved_at','restoredAt',to_jsonb(NEW)->>'restored_at',
        'submissionStartedAt',to_jsonb(NEW)->>'submitted_at','destination',to_jsonb(NEW)->>'destination_hint')));
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_chapa_receipt AFTER INSERT OR UPDATE ON chapa_payment_intents
  FOR EACH ROW EXECUTE FUNCTION audit_chapa_receipt();
INSERT INTO wallet_payment_events(payment_id,user_id,event_type,source,status,details)
  SELECT id,user_id,'history_imported','migration',status,jsonb_build_object('mode',mode,'amount',amount,'currency',currency,'originalCreatedAt',created_at)
  FROM chapa_payment_intents;

CREATE FUNCTION public.claim_chapa_checkout(_tx_ref text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p chapa_payment_intents;
BEGIN
  SELECT * INTO p FROM chapa_payment_intents WHERE tx_ref=_tx_ref FOR UPDATE;
  IF NOT FOUND OR p.status<>'pending' OR p.checkout_url IS NOT NULL OR p.checkout_lease_until>now() THEN RETURN false; END IF;
  PERFORM set_config('serkle.wallet_source','initialize',true);
  UPDATE chapa_payment_intents SET checkout_state='processing',checkout_lease_until=now()+interval '1 minute' WHERE id=p.id;
  RETURN true;
END;
$$;
CREATE FUNCTION public.save_chapa_checkout(_tx_ref text,_url text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _url !~ '^https://([a-zA-Z0-9-]+\.)*chapa\.co/' THEN RAISE EXCEPTION 'Invalid checkout destination'; END IF;
  PERFORM set_config('serkle.wallet_source','initialize',true);
  UPDATE chapa_payment_intents SET checkout_url=_url,checkout_state='ready',checkout_lease_until=NULL,last_error=NULL,last_error_code=NULL WHERE tx_ref=_tx_ref AND status='pending';
END;
$$;
CREATE FUNCTION public.claim_chapa_check(_tx_ref text,_source text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p chapa_payment_intents;
BEGIN
  IF _source NOT IN ('user','webhook','scheduled','reconcile') THEN RAISE EXCEPTION 'Invalid check source'; END IF;
  SELECT * INTO p FROM chapa_payment_intents WHERE tx_ref=_tx_ref FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF p.check_lease_until>now() OR p.checkout_lease_until>now() THEN RETURN 'busy'; END IF;
  -- Serialize the account's manual checks so a burst of requests cannot evade
  -- this limit by selecting different receipts. No provider call is made yet.
  IF _source IN ('user','reconcile') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('wallet-check:'||p.user_id::text,0));
    IF (SELECT count(*) FROM wallet_payment_events WHERE user_id=p.user_id AND event_type='check_started' AND source IN ('user','reconcile') AND created_at>now()-interval '1 minute')>=12 THEN RETURN 'rate_limited'; END IF;
  END IF;
  PERFORM set_config('serkle.wallet_source',_source,true);
  UPDATE chapa_payment_intents SET check_lease_until=now()+interval '2 minutes',check_started_at=now(),check_count=check_count+1,
    next_check_at=now()+interval '2 minutes' WHERE id=p.id;
  RETURN 'claimed';
END;
$$;

CREATE FUNCTION public.record_chapa_check(_evidence jsonb,_details jsonb,_source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; p chapa_payment_intents;
BEGIN
  IF _source NOT IN ('user','webhook','scheduled','reconcile') THEN RAISE EXCEPTION 'Invalid check source'; END IF;
  PERFORM set_config('serkle.wallet_source',_source,true);
  result:=apply_chapa_verification(_evidence->>'_tx_ref',_evidence->>'_status',(_evidence->>'_amount')::integer,
    _evidence->>'_currency',_evidence->>'_mode',_evidence->>'_provider_reference',(_evidence->>'_provider_updated_at')::timestamptz);
  UPDATE chapa_payment_intents SET check_lease_until=NULL,checkout_lease_until=NULL,
    provider_status=result->>'status',review_required=false,last_error=NULL,last_error_code=NULL,
    payment_method=COALESCE(NULLIF(left(_details->>'paymentMethod',80),''),payment_method),
    provider_fee=COALESCE(CASE WHEN (_details->>'fee') ~ '^\d+(\.\d{1,2})?$' THEN (_details->>'fee')::numeric END,provider_fee),
    next_check_at=now()+CASE WHEN reversed_at IS NOT NULL THEN interval '365 days'
      WHEN credited_at IS NULL AND status IN ('pending','failed') AND created_at>now()-interval '1 day' THEN interval '1 minute'
      ELSE interval '1 day' END
    WHERE tx_ref=_evidence->>'_tx_ref' RETURNING * INTO p;
  RETURN to_jsonb(p)||jsonb_build_object('credited',result->'credited','reversed',result->'reversed','replayed',result->'replayed');
END;
$$;
CREATE FUNCTION public.record_chapa_error(_tx_ref text,_stage text,_code text,_message text,_source text,_provider_status text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _stage NOT IN ('checkout','verification','fulfillment') OR _source NOT IN ('initialize','user','webhook','scheduled','reconcile') THEN RAISE EXCEPTION 'Invalid payment error context'; END IF;
  PERFORM set_config('serkle.wallet_source',_source,true);
  UPDATE chapa_payment_intents SET last_error=left(_message,250),last_error_code=left(_code,80),
    provider_status=COALESCE(_provider_status,provider_status),check_lease_until=NULL,checkout_lease_until=NULL,
    checkout_state=CASE WHEN _stage='checkout' AND checkout_url IS NULL THEN 'error' ELSE checkout_state END,
    review_required=review_required OR _code IN ('verification_mismatch','provider_state_unknown','fulfillment_error'),
    review_code=CASE WHEN review_code='withdrawal_state_conflict' THEN review_code WHEN _code IN ('verification_mismatch','provider_state_unknown','fulfillment_error') THEN _code ELSE review_code END,
    next_check_at=now()+make_interval(secs=>LEAST(900,60*power(2,LEAST(GREATEST(check_count-1,0),4)))::integer)
    WHERE tx_ref=_tx_ref;
END;
$$;

CREATE FUNCTION public.due_wallet_payments(_modes text[],_user_id uuid DEFAULT NULL,_limit integer DEFAULT 25)
RETURNS SETOF chapa_payment_intents LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _limit IS NULL OR _limit<1 OR _limit>25 OR _modes IS NULL OR NOT(_modes<@ARRAY['live','test']) THEN RAISE EXCEPTION 'Invalid reconciliation batch'; END IF;
  RETURN QUERY WITH due AS (
    SELECT p, (p.status IN ('pending','failed') AND p.credited_at IS NULL) AS urgent,
      row_number() OVER(PARTITION BY (p.status IN ('pending','failed') AND p.credited_at IS NULL) ORDER BY p.next_check_at,p.id) AS position
    FROM chapa_payment_intents p WHERE p.mode=ANY(_modes) AND (_user_id IS NULL OR p.user_id=_user_id)
      AND p.next_check_at<=now() AND p.reversed_at IS NULL
      AND (p.check_lease_until IS NULL OR p.check_lease_until<=now())
      AND (p.checkout_lease_until IS NULL OR p.checkout_lease_until<=now())
  ) SELECT (d.p).* FROM due d
    ORDER BY CASE WHEN NOT d.urgent AND d.position<=GREATEST(1,_limit/5) THEN 0 WHEN d.urgent THEN 1 ELSE 2 END,(d.p).next_check_at,(d.p).id LIMIT _limit;
END;
$$;

CREATE TABLE public.wallet_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mode text NOT NULL CHECK(mode IN ('live','test')),
  started_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
  checked integer NOT NULL DEFAULT 0 CHECK(checked>=0),errors integer NOT NULL DEFAULT 0 CHECK(errors>=0)
);
ALTER TABLE wallet_reconciliation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wallet_reconciliation_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON wallet_reconciliation_runs TO service_role;

-- Safe owner-only views. No caller can choose a different account, and cursor
-- pagination uses timestamp + UUID so equal timestamps do not lose receipts.
CREATE FUNCTION public.get_wallet_payment_history(_before_created_at timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 20,_mode text DEFAULT 'all')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE rows jsonb; runs jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF _limit IS NULL OR _limit<1 OR _limit>50 OR _mode NOT IN ('all','live','test') OR (_before_created_at IS NULL)<>(_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid history page'; END IF;
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC,p.id DESC) INTO rows FROM (
    SELECT id,tx_ref,amount,currency,mode,status,checkout_state,created_at,verified_at,next_check_at,credited_at,reversed_at,
      check_count,last_error,last_error_code,review_required,provider_reference,provider_status,payment_method,provider_fee
    FROM chapa_payment_intents WHERE user_id=auth.uid() AND (_mode='all' OR mode=_mode)
      AND (_before_created_at IS NULL OR (created_at,id)<(_before_created_at,_before_id))
    ORDER BY created_at DESC,id DESC LIMIT _limit+1
  ) p;
  SELECT jsonb_build_object('live',max(completed_at) FILTER(WHERE mode='live'),'test',max(completed_at) FILTER(WHERE mode='test')) INTO runs FROM wallet_reconciliation_runs;
  RETURN jsonb_build_object('userId',auth.uid(),'items',COALESCE(rows,'[]'),'automaticChecks',runs);
END;
$$;
CREATE FUNCTION public.get_wallet_payment_receipt(_payment_id uuid,_before_created_at timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 25) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE receipt jsonb; entries jsonb; timeline jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF _limit IS NULL OR _limit<1 OR _limit>50 OR (_before_created_at IS NULL)<>(_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid timeline page'; END IF;
  SELECT to_jsonb(p)-'checkout_url'-'request_id'-'checkout_lease_until'-'check_lease_until' INTO receipt
    FROM chapa_payment_intents p WHERE id=_payment_id AND user_id=auth.uid();
  IF receipt IS NULL THEN RAISE EXCEPTION 'Payment receipt not found' USING ERRCODE='42501'; END IF;
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at,t.id) INTO entries FROM coin_transactions t WHERE user_id=auth.uid() AND reference_id=_payment_id;
  SELECT jsonb_agg(to_jsonb(e)-'user_id' ORDER BY e.created_at DESC,e.id DESC) INTO timeline FROM (
    SELECT * FROM wallet_payment_events WHERE payment_id=_payment_id AND user_id=auth.uid()
      AND (_before_created_at IS NULL OR (created_at,id)<(_before_created_at,_before_id))
    ORDER BY created_at DESC,id DESC LIMIT _limit+1
  ) e;
  RETURN jsonb_build_object('userId',auth.uid(),'payment',receipt,'ledger',COALESCE(entries,'[]'),'events',COALESCE(timeline,'[]'));
END;
$$;
CREATE FUNCTION public.get_wallet_activity(_before_created_at timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF _limit IS NULL OR _limit<1 OR _limit>50 OR (_before_created_at IS NULL)<>(_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid activity page'; END IF;
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC) INTO rows FROM (
    SELECT * FROM coin_transactions WHERE user_id=auth.uid()
      AND (_before_created_at IS NULL OR (created_at,id)<(_before_created_at,_before_id))
    ORDER BY created_at DESC,id DESC LIMIT _limit+1
  ) t;
  RETURN jsonb_build_object('userId',auth.uid(),'items',COALESCE(rows,'[]'));
END;
$$;

REVOKE ALL ON FUNCTION audit_chapa_receipt(),wallet_event_immutable(),claim_chapa_checkout(text),save_chapa_checkout(text,text),claim_chapa_check(text,text),record_chapa_check(jsonb,jsonb,text),record_chapa_error(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION claim_chapa_checkout(text),save_chapa_checkout(text,text),claim_chapa_check(text,text),record_chapa_check(jsonb,jsonb,text),record_chapa_error(text,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION due_wallet_payments(text[],uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION due_wallet_payments(text[],uuid,integer) TO service_role;
REVOKE ALL ON FUNCTION get_wallet_payment_history(timestamptz,uuid,integer,text),get_wallet_payment_receipt(uuid,timestamptz,uuid,integer),get_wallet_activity(timestamptz,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION get_wallet_payment_history(timestamptz,uuid,integer,text),get_wallet_payment_receipt(uuid,timestamptz,uuid,integer),get_wallet_activity(timestamptz,uuid,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
