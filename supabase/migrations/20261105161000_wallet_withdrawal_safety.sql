-- A payout is a durable receipt before any provider request. Reserve live
-- funds once; restore them only after a matching provider-confirmed failure.
ALTER TABLE chapa_payment_intents
  ADD COLUMN kind text NOT NULL DEFAULT 'topup' CHECK(kind IN ('topup','withdrawal')),
  ADD COLUMN reserved_at timestamptz,
  ADD COLUMN restored_at timestamptz,
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN destination_hint text;
CREATE TABLE public.wallet_withdrawal_private (
  payment_id uuid PRIMARY KEY REFERENCES chapa_payment_intents(id),
  fingerprint text NOT NULL CHECK(length(fingerprint)=64),
  destination_hash text NOT NULL CHECK(length(destination_hash)=64),
  bank_code integer NOT NULL CHECK(bank_code>0)
);
ALTER TABLE wallet_withdrawal_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wallet_withdrawal_private FROM PUBLIC,anon,authenticated;
GRANT SELECT ON wallet_withdrawal_private TO service_role;

-- The old unbound debit endpoint cannot create new withdrawals, even through
-- an accidentally retained older Edge function deployment.
CREATE OR REPLACE FUNCTION public.request_withdrawal(_user_id uuid,_amount integer,_payout_method text DEFAULT 'bank_transfer')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Use the recorded withdrawal flow with a request ID' USING ERRCODE='42501'; END;
$$;

CREATE OR REPLACE FUNCTION public.begin_chapa_payment(_user_id uuid,_request_id uuid,_amount integer,_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p chapa_payment_intents;
BEGIN
  IF _user_id IS NULL OR _request_id IS NULL OR _amount IS NULL OR _amount NOT BETWEEN 10 AND 1000000 OR _mode NOT IN ('live','test') THEN RAISE EXCEPTION 'Invalid payment request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('chapa-init:'||_user_id::text,0));
  SELECT * INTO p FROM chapa_payment_intents WHERE user_id=_user_id AND request_id=_request_id;
  IF FOUND THEN
    IF p.amount<>_amount OR p.mode<>_mode OR p.kind<>'topup' THEN RAISE EXCEPTION 'Idempotency key reused for a different payment'; END IF;
    RETURN to_jsonb(p);
  END IF;
  INSERT INTO chapa_payment_intents(user_id,request_id,amount,mode,tx_ref,kind)
    VALUES(_user_id,_request_id,_amount,_mode,'serkle-'||gen_random_uuid()::text,'topup') RETURNING * INTO p;
  RETURN to_jsonb(p);
END;
$$;
CREATE FUNCTION public.guard_withdrawal_credit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind='withdrawal' AND NEW.credited_at IS NOT NULL THEN RAISE EXCEPTION 'A withdrawal cannot receive a top-up credit'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_withdrawal_credit BEFORE INSERT OR UPDATE ON chapa_payment_intents FOR EACH ROW EXECUTE FUNCTION guard_withdrawal_credit();

CREATE FUNCTION public.begin_wallet_withdrawal(_user_id uuid,_request_id uuid,_amount integer,_mode text,_fingerprint text,_destination_hash text,_bank_code integer,_destination_hint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p chapa_payment_intents; remaining integer;
BEGIN
  IF _user_id IS NULL OR _request_id IS NULL OR _amount IS NULL OR _amount NOT BETWEEN 10 AND 1000000 OR _mode NOT IN ('live','test') OR _bank_code<=0
    OR length(_fingerprint)<>64 OR length(_destination_hash)<>64 THEN RAISE EXCEPTION 'Invalid withdrawal request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('chapa-init:'||_user_id::text,0));
  SELECT * INTO p FROM chapa_payment_intents WHERE user_id=_user_id AND request_id=_request_id FOR UPDATE;
  IF FOUND THEN
    IF p.kind<>'withdrawal' OR p.amount<>_amount OR p.mode<>_mode OR NOT EXISTS(SELECT 1 FROM wallet_withdrawal_private WHERE payment_id=p.id AND fingerprint=_fingerprint) THEN RAISE EXCEPTION 'Idempotency key reused for a different withdrawal'; END IF;
    RETURN to_jsonb(p);
  END IF;
  PERFORM set_config('serkle.wallet_source','initialize',true);
  INSERT INTO chapa_payment_intents(user_id,request_id,amount,mode,tx_ref,kind,destination_hint)
    VALUES(_user_id,_request_id,_amount,_mode,'withdrawal-'||gen_random_uuid()::text,'withdrawal',left(_destination_hint,120)) RETURNING * INTO p;
  INSERT INTO wallet_withdrawal_private(payment_id,fingerprint,destination_hash,bank_code) VALUES(p.id,_fingerprint,_destination_hash,_bank_code);
  IF _mode='live' THEN
    UPDATE coin_wallets SET balance=balance-_amount,total_spent=total_spent+_amount,updated_at=now()
      WHERE user_id=_user_id AND balance>=_amount RETURNING balance INTO remaining;
    IF NOT FOUND THEN
      UPDATE chapa_payment_intents SET status='failed',checkout_state='error',last_error_code='insufficient_balance',last_error='Insufficient balance. No payout was sent and no coins were removed.',next_check_at=now()+interval '365 days'
        WHERE id=p.id RETURNING * INTO p;
      RETURN to_jsonb(p);
    END IF;
    INSERT INTO coin_transactions(user_id,amount,type,reference_id,description,balance_after)
      VALUES(_user_id,-_amount,'withdrawal',p.id,'Funds reserved for Chapa withdrawal',remaining);
    INSERT INTO coin_withdrawals(id,user_id,amount,payout_method,status) VALUES(p.id,_user_id,_amount,'chapa_bank_transfer','pending');
    UPDATE chapa_payment_intents SET reserved_at=now() WHERE id=p.id RETURNING * INTO p;
  END IF;
  RETURN to_jsonb(p);
END;
$$;
CREATE FUNCTION public.claim_wallet_withdrawal_submit(_tx_ref text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p chapa_payment_intents;
BEGIN
  SELECT * INTO p FROM chapa_payment_intents WHERE tx_ref=_tx_ref FOR UPDATE;
  IF NOT FOUND OR p.kind<>'withdrawal' OR p.status<>'pending' OR p.submitted_at IS NOT NULL OR (p.mode='live' AND p.reserved_at IS NULL) THEN RETURN false; END IF;
  PERFORM set_config('serkle.wallet_source','initialize',true);
  UPDATE chapa_payment_intents SET submitted_at=now(),checkout_state='processing',checkout_lease_until=now()+interval '1 minute' WHERE id=p.id;
  RETURN true;
END;
$$;
CREATE FUNCTION public.record_wallet_withdrawal_submission(_tx_ref text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM set_config('serkle.wallet_source','initialize',true);
  UPDATE chapa_payment_intents SET checkout_state='ready',checkout_lease_until=NULL,next_check_at=now() WHERE tx_ref=_tx_ref AND kind='withdrawal';
END;
$$;
CREATE FUNCTION public.recover_unsent_withdrawal(_tx_ref text,_source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p chapa_payment_intents; remaining integer;
BEGIN
  IF _source NOT IN ('user','webhook','scheduled','reconcile') THEN RAISE EXCEPTION 'Invalid check source'; END IF;
  SELECT * INTO p FROM chapa_payment_intents WHERE tx_ref=_tx_ref AND kind='withdrawal' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF p.submitted_at IS NOT NULL OR p.restored_at IS NOT NULL THEN RETURN to_jsonb(p); END IF;
  PERFORM set_config('serkle.wallet_source',_source,true);
  IF p.status='pending' AND p.created_at<now()-interval '2 minutes' THEN
    IF p.mode='live' AND p.reserved_at IS NOT NULL THEN
      UPDATE coin_wallets SET balance=balance+p.amount,total_spent=total_spent-p.amount,updated_at=now() WHERE user_id=p.user_id RETURNING balance INTO remaining;
      IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal wallet unavailable'; END IF;
      INSERT INTO coin_transactions(user_id,amount,type,reference_id,description,balance_after) VALUES(p.user_id,p.amount,'refund',p.id,'Reserved coins returned: payout was never submitted',remaining);
    END IF;
    UPDATE chapa_payment_intents SET status='failed',restored_at=CASE WHEN reserved_at IS NOT NULL THEN now() END,
      last_error='No payout was submitted. Any reserved coins have been returned.',last_error_code='withdrawal_not_submitted',check_lease_until=NULL,next_check_at=now()+interval '365 days'
      WHERE id=p.id RETURNING * INTO p;
    UPDATE coin_withdrawals SET status='failed' WHERE id=p.id;
  ELSE
    UPDATE chapa_payment_intents SET check_lease_until=NULL,next_check_at=now()+CASE WHEN p.status='pending' THEN interval '1 minute' ELSE interval '365 days' END WHERE id=p.id RETURNING * INTO p;
    INSERT INTO wallet_payment_events(payment_id,user_id,event_type,source,status,message) VALUES(p.id,p.user_id,'check_unchanged',_source,p.status,'Payout submission has not been confirmed yet.');
  END IF;
  RETURN to_jsonb(p);
END;
$$;

CREATE FUNCTION public.apply_wallet_withdrawal_check(_evidence jsonb,_details jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p chapa_payment_intents; remaining integer; state text:=_evidence->>'_status'; stamp timestamptz:=(_evidence->>'_provider_updated_at')::timestamptz;
BEGIN
  SELECT * INTO p FROM chapa_payment_intents WHERE tx_ref=_evidence->>'_tx_ref' FOR UPDATE;
  IF NOT FOUND OR p.kind<>'withdrawal' OR (_evidence->>'_amount')::integer IS DISTINCT FROM p.amount
    OR p.submitted_at IS NULL OR (p.mode='live' AND p.reserved_at IS NULL)
    OR _evidence->>'_currency' IS DISTINCT FROM p.currency OR _evidence->>'_mode' IS DISTINCT FROM p.mode
    OR state NOT IN ('pending','succeeded','failed','reversed') OR stamp IS NULL OR stamp>now()+interval '5 minutes'
    OR NULLIF(_evidence->>'_provider_reference','') IS NULL
    OR NOT EXISTS(SELECT 1 FROM wallet_withdrawal_private WHERE payment_id=p.id AND destination_hash=_details->>'destinationHash')
    THEN RAISE EXCEPTION 'Withdrawal verification mismatch' USING ERRCODE='22023'; END IF;
  IF p.provider_reference IS NOT NULL AND p.provider_reference<>_evidence->>'_provider_reference' THEN RAISE EXCEPTION 'Withdrawal verification mismatch' USING ERRCODE='22023'; END IF;
  IF p.restored_at IS NOT NULL THEN
    -- A provider claiming success after a confirmed failure/refund requires an
    -- operator. Never debit the user again or send another payout silently.
    IF state='succeeded' THEN UPDATE chapa_payment_intents SET review_required=true,review_code='withdrawal_state_conflict',last_error_code='withdrawal_state_conflict',last_error='Provider status changed after funds were returned. This receipt needs review.' WHERE id=p.id RETURNING * INTO p; END IF;
    RETURN to_jsonb(p);
  END IF;
  IF p.provider_updated_at IS NOT NULL AND stamp<p.provider_updated_at THEN RETURN to_jsonb(p); END IF;
  IF p.status='succeeded' AND state IN ('pending','failed') THEN
    IF state='failed' THEN UPDATE chapa_payment_intents SET review_required=true,review_code='withdrawal_state_conflict',last_error_code='withdrawal_state_conflict',last_error='Provider status changed after payout completion. This receipt needs review.' WHERE id=p.id RETURNING * INTO p; END IF;
    RETURN to_jsonb(p);
  END IF;
  IF state IN ('failed','reversed') AND p.mode='live' AND p.reserved_at IS NOT NULL THEN
    UPDATE coin_wallets SET balance=balance+p.amount,total_spent=total_spent-p.amount,updated_at=now() WHERE user_id=p.user_id RETURNING balance INTO remaining;
    IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal wallet unavailable'; END IF;
    INSERT INTO coin_transactions(user_id,amount,type,reference_id,description,balance_after)
      VALUES(p.user_id,p.amount,'refund',p.id,'Funds returned after verified Chapa withdrawal failure',remaining);
    UPDATE chapa_payment_intents SET restored_at=now() WHERE id=p.id;
  END IF;
  UPDATE chapa_payment_intents SET status=state,provider_reference=_evidence->>'_provider_reference',provider_updated_at=stamp,verified_at=now(),provider_status=state,
    reversed_at=CASE WHEN state='reversed' THEN now() ELSE reversed_at END WHERE id=p.id RETURNING * INTO p;
  IF p.mode='live' THEN UPDATE coin_withdrawals SET status=CASE WHEN state='succeeded' THEN 'completed' WHEN state IN ('failed','reversed') THEN 'failed' ELSE 'pending' END WHERE id=p.id AND user_id=p.user_id; END IF;
  RETURN to_jsonb(p);
END;
$$;

-- Reuse the verified check journal for withdrawals. The original top-up credit
-- function remains isolated and cannot accidentally mint a payout as a top-up.
CREATE OR REPLACE FUNCTION public.record_chapa_check(_evidence jsonb,_details jsonb,_source text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; p chapa_payment_intents;
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

-- Include both payment directions in existing paginated receipt views.
CREATE OR REPLACE FUNCTION public.get_wallet_payment_history(_before_created_at timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 20,_mode text DEFAULT 'all')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE rows jsonb; runs jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF _limit IS NULL OR _limit<1 OR _limit>50 OR _mode NOT IN ('all','live','test') OR (_before_created_at IS NULL)<>(_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid history page'; END IF;
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC,p.id DESC) INTO rows FROM (
    SELECT id,tx_ref,kind,amount,currency,mode,status,checkout_state,created_at,verified_at,next_check_at,credited_at,reversed_at,reserved_at,restored_at,submitted_at,destination_hint,
      check_count,last_error,last_error_code,review_required,provider_reference,provider_status,payment_method,provider_fee
    FROM chapa_payment_intents WHERE user_id=auth.uid() AND (_mode='all' OR mode=_mode)
      AND (_before_created_at IS NULL OR (created_at,id)<(_before_created_at,_before_id)) ORDER BY created_at DESC,id DESC LIMIT _limit+1
  ) p;
  SELECT jsonb_build_object('live',max(completed_at) FILTER(WHERE mode='live'),'test',max(completed_at) FILTER(WHERE mode='test')) INTO runs FROM wallet_reconciliation_runs;
  RETURN jsonb_build_object('userId',auth.uid(),'items',COALESCE(rows,'[]'),'automaticChecks',runs);
END;
$$;
REVOKE ALL ON FUNCTION guard_withdrawal_credit(),begin_wallet_withdrawal(uuid,uuid,integer,text,text,text,integer,text),claim_wallet_withdrawal_submit(text),record_wallet_withdrawal_submission(text),recover_unsent_withdrawal(text,text),apply_wallet_withdrawal_check(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION begin_wallet_withdrawal(uuid,uuid,integer,text,text,text,integer,text),claim_wallet_withdrawal_submit(text),record_wallet_withdrawal_submission(text),recover_unsent_withdrawal(text,text) TO service_role;
NOTIFY pgrst,'reload schema';
