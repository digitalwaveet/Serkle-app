-- Chapa funds the wallet. A separate explicit, atomic Circle purchase spends
-- coins and creates its entitlement. A checkout return is never proof of either.
CREATE TABLE public.chapa_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL,
  tx_ref text NOT NULL UNIQUE,
  amount integer NOT NULL CHECK(amount BETWEEN 10 AND 1000000),
  currency text NOT NULL DEFAULT 'ETB' CHECK(currency='ETB'),
  mode text NOT NULL CHECK(mode IN ('live','test')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','failed','succeeded','refunded','reversed')),
  provider_reference text,
  checkout_url text,
  credited_at timestamptz,
  reversed_at timestamptz,
  provider_updated_at timestamptz,
  verified_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id), UNIQUE(mode,provider_reference)
);
CREATE INDEX chapa_reconcile_due ON chapa_payment_intents(next_check_at);
ALTER TABLE chapa_payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY chapa_intents_self_read ON chapa_payment_intents FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON chapa_payment_intents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON chapa_payment_intents TO authenticated;

CREATE TABLE public.chapa_webhook_deliveries (
  body_hash text PRIMARY KEY,
  tx_ref text NOT NULL,
  mode text NOT NULL,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);
ALTER TABLE chapa_webhook_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON chapa_webhook_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON chapa_webhook_deliveries TO service_role;
GRANT SELECT,INSERT,UPDATE ON chapa_payment_intents TO service_role;

-- The old demo RPC could mint spendable coins without a payment. Ledger writes
-- and wallet balances are now reachable only through trusted server functions.
REVOKE INSERT,UPDATE,DELETE ON coin_wallets,coin_transactions,coin_topups FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON coin_withdrawals FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.topup_coins(uuid,integer,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.topup_coins(_user_id uuid,_amount integer,_payment_method text DEFAULT 'demo')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Unverified top-ups are disabled; use Chapa verification' USING ERRCODE='42501'; END;
$$;

-- The old negative-amount withdrawal path was another way to mint coins that
-- could buy premium access. Preserve the existing authenticated Edge payout
-- flow, but deny direct client RPC calls and reject nonpositive amounts.
CREATE OR REPLACE FUNCTION public.request_withdrawal(_user_id uuid,_amount integer,_payout_method text DEFAULT 'bank_transfer')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE current_balance integer;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount<10 THEN RAISE EXCEPTION 'Invalid withdrawal amount'; END IF;
  UPDATE coin_wallets SET balance=balance-_amount,total_spent=total_spent+_amount,updated_at=now()
    WHERE user_id=_user_id AND balance>=_amount RETURNING balance INTO current_balance;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO coin_transactions(user_id,amount,type,description,balance_after) VALUES(_user_id,-_amount,'withdrawal','Withdrawal request via '||COALESCE(_payout_method,'bank_transfer'),current_balance);
  INSERT INTO coin_withdrawals(user_id,amount,payout_method) VALUES(_user_id,_amount,_payout_method);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION request_withdrawal(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION request_withdrawal(uuid,integer,text) TO service_role;

CREATE FUNCTION public.begin_chapa_payment(_user_id uuid,_request_id uuid,_amount integer,_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p chapa_payment_intents;
BEGIN
  IF _user_id IS NULL OR _request_id IS NULL OR _amount IS NULL OR _amount NOT BETWEEN 10 AND 1000000 OR _mode NOT IN ('live','test') THEN RAISE EXCEPTION 'Invalid payment request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('chapa-init:'||_user_id::text,0));
  SELECT * INTO p FROM chapa_payment_intents WHERE user_id=_user_id AND request_id=_request_id;
  IF FOUND THEN
    IF p.amount<>_amount OR p.mode<>_mode THEN RAISE EXCEPTION 'Idempotency key reused for a different payment'; END IF;
    RETURN to_jsonb(p);
  END IF;
  INSERT INTO chapa_payment_intents(user_id,request_id,amount,mode,tx_ref)
    VALUES(_user_id,_request_id,_amount,_mode,'serkle-'||gen_random_uuid()::text) RETURNING * INTO p;
  RETURN to_jsonb(p);
END;
$$;

-- Only the service role may supply provider-verified evidence. The endpoint
-- validates its JWT/webhook and queries Chapa before calling this function.
CREATE FUNCTION public.apply_chapa_verification(_tx_ref text,_status text,_amount integer,_currency text,
  _mode text,_provider_reference text,_provider_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p chapa_payment_intents; credit integer := 0; debit integer := 0;
BEGIN
  SELECT * INTO p FROM chapa_payment_intents WHERE tx_ref=_tx_ref FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown payment reference'; END IF;
  IF _amount IS DISTINCT FROM p.amount OR _currency IS DISTINCT FROM p.currency OR _mode IS DISTINCT FROM p.mode
    OR NULLIF(_provider_reference,'') IS NULL OR _provider_updated_at IS NULL OR _provider_updated_at>now()+interval '5 minutes'
    OR _status NOT IN ('pending','failed','succeeded','refunded','reversed') THEN RAISE EXCEPTION 'Payment verification mismatch'; END IF;
  IF p.provider_reference IS NOT NULL AND p.provider_reference<>_provider_reference THEN RAISE EXCEPTION 'Provider reference changed'; END IF;
  -- Refund/reversal is terminal. Old success deliveries can never credit again.
  IF p.reversed_at IS NOT NULL OR (p.provider_updated_at IS NOT NULL AND _provider_updated_at<p.provider_updated_at) THEN
    RETURN to_jsonb(p)||jsonb_build_object('credited',0,'reversed',0,'replayed',true);
  END IF;
  -- A stale failed/pending response cannot undo an already verified payment.
  IF p.credited_at IS NOT NULL AND _status IN ('pending','failed') THEN
    RETURN to_jsonb(p)||jsonb_build_object('credited',0,'reversed',0,'replayed',true);
  END IF;
  -- Test-mode money must never become spendable value in the application.
  IF _status='succeeded' AND p.credited_at IS NULL AND p.mode='live' THEN credit:=p.amount; END IF;
  IF _status IN ('refunded','reversed') AND p.credited_at IS NOT NULL THEN debit:=p.amount; END IF;
  IF credit<>0 OR debit<>0 THEN
    INSERT INTO coin_wallets(user_id) VALUES(p.user_id) ON CONFLICT DO NOTHING;
    UPDATE coin_wallets SET balance=balance+credit-debit,total_earned=total_earned+credit-debit,updated_at=now() WHERE user_id=p.user_id;
    INSERT INTO coin_transactions(user_id,amount,type,reference_id,description,balance_after)
      SELECT p.user_id,credit-debit,CASE WHEN credit>0 THEN 'topup'::coin_transaction_type ELSE 'refund'::coin_transaction_type END,
        p.id,CASE WHEN credit>0 THEN 'Verified Chapa top-up' ELSE 'Verified Chapa top-up reversal' END,balance FROM coin_wallets WHERE user_id=p.user_id;
    IF credit>0 THEN INSERT INTO coin_topups(user_id,amount,payment_method,status) VALUES(p.user_id,credit,'chapa','completed'); END IF;
  END IF;
  UPDATE chapa_payment_intents SET status=_status,provider_reference=_provider_reference,
    provider_updated_at=_provider_updated_at,verified_at=now(),last_error=NULL,
    credited_at=CASE WHEN credit>0 THEN now() ELSE credited_at END,
    reversed_at=CASE WHEN _status IN ('refunded','reversed') THEN now() ELSE reversed_at END,
    attempts=attempts+1,next_check_at=now()+CASE WHEN _status='pending' THEN interval '1 minute' ELSE interval '1 day' END
    WHERE id=p.id RETURNING * INTO p;
  RETURN to_jsonb(p)||jsonb_build_object('credited',credit,'reversed',debit,'replayed',credit=0 AND debit=0);
END;
$$;

-- Restore grants only from real, nonrefunded, server-paid Circle receipts. This
-- repairs interrupted legacy flows without allowing client "success" messages
-- or fabricated records to create access. Legacy grants keep their own rules.
CREATE FUNCTION public.reconcile_circle_receipts(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('circle-payment:'||_user_id::text,0));
  UPDATE post_unlocks u SET refunded_at=COALESCE(u.refunded_at,p.refunded_at,now()) FROM circle_payment_requests p
    WHERE u.user_id=_user_id AND u.payment_id=p.id AND (p.refunded_at IS NOT NULL OR p.user_id<>u.user_id OR p.target_id<>u.post_id OR p.kind<>'post');
  UPDATE video_unlocks u SET refunded_at=COALESCE(u.refunded_at,p.refunded_at,now()) FROM circle_payment_requests p
    WHERE u.user_id=_user_id AND u.payment_id=p.id AND (p.refunded_at IS NOT NULL OR p.user_id<>u.user_id OR p.target_id<>u.video_id OR p.kind<>'video');
  INSERT INTO post_unlocks(post_id,user_id,amount_paid,payment_id)
    SELECT p.target_id,p.user_id,p.amount,p.id FROM circle_payment_requests p JOIN posts c ON c.id=p.target_id
      WHERE p.user_id=_user_id AND p.kind='post' AND p.amount>0 AND p.refunded_at IS NULL
      AND EXISTS(SELECT 1 FROM coin_transactions t WHERE t.reference_id=p.id AND t.user_id=p.user_id AND t.amount=-p.amount AND t.type='premium_unlock')
    ON CONFLICT(post_id,user_id) DO UPDATE SET amount_paid=EXCLUDED.amount_paid,payment_id=EXCLUDED.payment_id,refunded_at=NULL;
  INSERT INTO video_unlocks(video_id,user_id,amount_paid,payment_id)
    SELECT p.target_id,p.user_id,p.amount,p.id FROM circle_payment_requests p JOIN circle_videos c ON c.id=p.target_id
      WHERE p.user_id=_user_id AND p.kind='video' AND p.amount>0 AND p.refunded_at IS NULL
      AND EXISTS(SELECT 1 FROM coin_transactions t WHERE t.reference_id=p.id AND t.user_id=p.user_id AND t.amount=-p.amount AND t.type='premium_unlock')
    ON CONFLICT(video_id,user_id) DO UPDATE SET amount_paid=EXCLUDED.amount_paid,payment_id=EXCLUDED.payment_id,refunded_at=NULL;
  INSERT INTO circle_subscriptions(circle_id,user_id,status,started_at,expires_at,payment_managed)
    SELECT p.target_id,p.user_id,'active',min(p.period_start),max(p.period_end),true FROM circle_payment_requests p JOIN circles c ON c.id=p.target_id
      WHERE p.user_id=_user_id AND p.kind='subscription' AND p.amount>0 AND p.refunded_at IS NULL
      AND EXISTS(SELECT 1 FROM coin_transactions t WHERE t.reference_id=p.id AND t.user_id=p.user_id AND t.amount=-p.amount AND t.type='subscription')
      GROUP BY p.target_id,p.user_id
    ON CONFLICT(circle_id,user_id) DO UPDATE SET
      legacy_access_until=CASE WHEN NOT circle_subscriptions.payment_managed AND circle_subscriptions.status='active' THEN circle_subscriptions.expires_at ELSE circle_subscriptions.legacy_access_until END,
      expires_at=CASE WHEN NOT circle_subscriptions.payment_managed AND circle_subscriptions.status='active' AND circle_subscriptions.expires_at IS NULL THEN NULL
        ELSE GREATEST(CASE WHEN NOT circle_subscriptions.payment_managed AND circle_subscriptions.status='active' THEN circle_subscriptions.expires_at ELSE circle_subscriptions.legacy_access_until END,EXCLUDED.expires_at) END,
      status='active',payment_managed=NOT(NOT circle_subscriptions.payment_managed AND circle_subscriptions.status='active' AND circle_subscriptions.expires_at IS NULL),refunded_at=NULL,updated_at=now();
END;
$$;

CREATE FUNCTION public.circle_receipt_paid(_payment uuid,_user uuid,_kind text,_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM circle_payment_requests p WHERE p.id=_payment AND p.user_id=_user AND p.kind=_kind AND p.target_id=_target AND p.amount>0 AND p.refunded_at IS NULL
    AND EXISTS(SELECT 1 FROM coin_transactions t WHERE t.reference_id=p.id AND t.user_id=p.user_id AND t.amount=-p.amount
      AND t.type=CASE WHEN p.kind='subscription' THEN 'subscription'::coin_transaction_type ELSE 'premium_unlock'::coin_transaction_type END));
$$;
REVOKE ALL ON FUNCTION circle_receipt_paid(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.has_circle_subscription(_circle_id uuid,_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM circle_subscriptions s WHERE s.circle_id=_circle_id AND s.user_id=_user_id AND s.status='active' AND s.refunded_at IS NULL
    AND (s.started_at IS NULL OR s.started_at<=now()) AND (s.expires_at IS NULL OR s.expires_at>now())
    AND (NOT s.payment_managed OR s.legacy_access_until>now() OR EXISTS(
      SELECT 1 FROM circle_payment_requests p WHERE p.user_id=_user_id AND p.kind='subscription' AND p.target_id=_circle_id
        AND p.period_start<=now() AND p.period_end>now() AND circle_receipt_paid(p.id,_user_id,'subscription',_circle_id))));
$$;

CREATE OR REPLACE FUNCTION public.circle_content_access(_kind text,_id uuid,_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c uuid; owner_id uuid; premium boolean; bought boolean:=false;
BEGIN
  IF _kind='post' THEN
    SELECT circle_id,user_id,COALESCE(is_premium,false) INTO c,owner_id,premium FROM posts WHERE id=_id;
    SELECT EXISTS(SELECT 1 FROM post_unlocks u WHERE u.post_id=_id AND u.user_id=_user AND u.refunded_at IS NULL
      AND (u.payment_id IS NULL OR circle_receipt_paid(u.payment_id,_user,'post',_id))) INTO bought;
  ELSIF _kind='video' THEN
    SELECT circle_id,user_id,COALESCE(is_premium,false) INTO c,owner_id,premium FROM circle_videos WHERE id=_id;
    SELECT EXISTS(SELECT 1 FROM video_unlocks u WHERE u.video_id=_id AND u.user_id=_user AND u.refunded_at IS NULL
      AND (u.payment_id IS NULL OR circle_receipt_paid(u.payment_id,_user,'video',_id))) INTO bought;
  ELSIF _kind='resource' THEN SELECT circle_id,uploader_id,COALESCE(is_premium,false) INTO c,owner_id,premium FROM circle_resources WHERE id=_id;
  ELSE RETURN false; END IF;
  IF owner_id IS NULL THEN RETURN false; END IF;
  IF _user=owner_id OR bought THEN RETURN true; END IF;
  IF c IS NULL THEN RETURN NOT premium; END IF;
  IF EXISTS(SELECT 1 FROM circles WHERE id=c AND creator_id=_user) THEN RETURN true; END IF;
  RETURN can_browse_circle(c,_user) AND (NOT premium OR has_circle_subscription(c,_user));
END;
$$;
REVOKE ALL ON FUNCTION begin_chapa_payment(uuid,uuid,integer,text),apply_chapa_verification(text,text,integer,text,text,text,timestamptz),reconcile_circle_receipts(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION begin_chapa_payment(uuid,uuid,integer,text),apply_chapa_verification(text,text,integer,text,text,text,timestamptz),reconcile_circle_receipts(uuid) TO service_role;

-- Repair from the caller's paid receipts in the SAME transaction before a new
-- price is considered. A missing grant must never cause a duplicate charge.
ALTER FUNCTION public.purchase_circle_access(text,uuid,uuid,boolean,timestamptz,integer) RENAME TO purchase_circle_access_paid;
REVOKE ALL ON FUNCTION purchase_circle_access_paid(text,uuid,uuid,boolean,timestamptz,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.purchase_circle_access(_kind text,_target_id uuid,_request_id uuid,
  _renew boolean DEFAULT false,_expected_expires_at timestamptz DEFAULT NULL,_expected_price integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  PERFORM reconcile_circle_receipts(auth.uid());
  RETURN purchase_circle_access_paid(_kind,_target_id,_request_id,_renew,_expected_expires_at,_expected_price);
END;
$$;
REVOKE ALL ON FUNCTION purchase_circle_access(text,uuid,uuid,boolean,timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION purchase_circle_access(text,uuid,uuid,boolean,timestamptz,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.unlock_premium_post(_user_id uuid,_post_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid()<>_user_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM purchase_circle_access('post',_post_id,gen_random_uuid(),false,NULL,(SELECT premium_price FROM posts WHERE id=_post_id));
  RETURN true;
END;
$$;
