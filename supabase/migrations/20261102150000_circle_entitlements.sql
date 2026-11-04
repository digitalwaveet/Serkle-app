-- Approved coverage: premium posts, videos and resources. Events/services are
-- separate. Calendar-month terms, period-end cancellation, immediate refunds.
-- All debit/grant/refund operations below run in ONE database transaction.
CREATE TABLE public.circle_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  seller_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('subscription', 'post', 'video')),
  target_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  period_start timestamptz,
  period_end timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);
CREATE UNIQUE INDEX circle_one_paid_unlock ON public.circle_payment_requests(user_id, kind, target_id)
  WHERE kind IN ('post', 'video') AND amount > 0 AND refunded_at IS NULL;
ALTER TABLE public.circle_payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY circle_payment_read ON public.circle_payment_requests FOR SELECT
  USING (user_id = auth.uid() OR seller_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.circle_payment_requests FROM anon, authenticated;
GRANT SELECT ON public.circle_payment_requests TO authenticated;

ALTER TABLE public.circle_subscriptions ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE public.circle_subscriptions ADD COLUMN payment_managed boolean NOT NULL DEFAULT false;
ALTER TABLE public.circle_subscriptions ADD COLUMN refunded_at timestamptz;
ALTER TABLE public.circle_subscriptions ADD COLUMN legacy_access_until timestamptz;
ALTER TABLE public.post_unlocks ADD COLUMN refunded_at timestamptz;
ALTER TABLE public.post_unlocks ADD COLUMN payment_id uuid REFERENCES public.circle_payment_requests(id);
ALTER TABLE public.video_unlocks ADD COLUMN refunded_at timestamptz;
ALTER TABLE public.video_unlocks ADD COLUMN payment_id uuid REFERENCES public.circle_payment_requests(id);

-- Clients can read grants, but cannot self-grant, reactivate or erase refunds.
REVOKE INSERT, UPDATE, DELETE ON public.circle_subscriptions, public.post_unlocks, public.video_unlocks FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_circle_subscription(_circle_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_subscriptions s
    WHERE s.circle_id = _circle_id AND s.user_id = _user_id
      AND s.status = 'active' AND s.refunded_at IS NULL
      AND (s.started_at IS NULL OR s.started_at <= now()) AND (s.expires_at IS NULL OR s.expires_at > now())
      AND (NOT s.payment_managed OR s.legacy_access_until > now() OR EXISTS (
        SELECT 1 FROM public.circle_payment_requests p
        WHERE p.user_id = _user_id AND p.kind = 'subscription' AND p.target_id = _circle_id
          AND p.amount > 0 AND p.refunded_at IS NULL
          AND p.period_start <= now() AND p.period_end > now()
      ))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_browse_circle(_circle uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.circles c WHERE c.id = _circle
    AND (NOT c.is_private OR c.creator_id = _user OR public.is_circle_member(c.id, _user)
      OR public.has_circle_subscription(c.id, _user)));
$$;

CREATE OR REPLACE FUNCTION public.circle_content_access(_kind text, _id uuid, _user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _circle uuid; _owner uuid; _premium boolean; _bought boolean := false;
BEGIN
  IF _kind = 'post' THEN
    SELECT circle_id, user_id, COALESCE(is_premium, false) INTO _circle, _owner, _premium FROM posts WHERE id = _id;
    SELECT EXISTS(SELECT 1 FROM post_unlocks WHERE post_id = _id AND user_id = _user AND refunded_at IS NULL) INTO _bought;
  ELSIF _kind = 'video' THEN
    SELECT circle_id, user_id, COALESCE(is_premium, false) INTO _circle, _owner, _premium FROM circle_videos WHERE id = _id;
    SELECT EXISTS(SELECT 1 FROM video_unlocks WHERE video_id = _id AND user_id = _user AND refunded_at IS NULL) INTO _bought;
  ELSIF _kind = 'resource' THEN
    SELECT circle_id, uploader_id, COALESCE(is_premium, false) INTO _circle, _owner, _premium FROM circle_resources WHERE id = _id;
  ELSE RETURN false;
  END IF;
  IF _owner IS NULL THEN RETURN false; END IF;
  IF _user = _owner OR _bought THEN RETURN true; END IF;
  IF _circle IS NULL THEN RETURN NOT _premium; END IF;
  IF EXISTS(SELECT 1 FROM circles WHERE id = _circle AND creator_id = _user) THEN RETURN true; END IF;
  RETURN public.can_browse_circle(_circle, _user)
    AND (NOT _premium OR public.has_circle_subscription(_circle, _user));
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_circle_access(
  _kind text, _target_id uuid, _request_id uuid,
  _renew boolean DEFAULT false, _expected_expires_at timestamptz DEFAULT NULL, _expected_price integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET timezone = 'UTC' AS $$
DECLARE
  _user uuid := auth.uid(); _seller uuid; _circle uuid; _price integer;
  _payment circle_payment_requests%ROWTYPE; _sub circle_subscriptions%ROWTYPE;
  _start timestamptz; _end timestamptz; _access boolean; _charged integer := 0;
BEGIN
  IF _user IS NULL OR _request_id IS NULL THEN RAISE EXCEPTION 'Authentication and request ID required'; END IF;
  -- Serialize all payment attempts for a buyer, including retries with different IDs.
  PERFORM pg_advisory_xact_lock(hashtextextended('circle-payment:' || _user::text, 0));
  SELECT * INTO _payment FROM circle_payment_requests WHERE user_id = _user AND request_id = _request_id;
  IF FOUND THEN
    IF _payment.kind <> _kind OR _payment.target_id <> _target_id THEN RAISE EXCEPTION 'Idempotency key reused for a different purchase'; END IF;
    _access := CASE WHEN _kind = 'subscription' THEN has_circle_subscription(_target_id, _user) ELSE circle_content_access(_kind, _target_id, _user) END;
    RETURN jsonb_build_object('payment_id', _payment.id, 'charged', 0, 'replayed', true, 'refunded', _payment.refunded_at IS NOT NULL, 'has_access', _access);
  END IF;

  IF _kind = 'subscription' THEN
    SELECT creator_id, subscription_price INTO _seller, _price FROM circles WHERE id = _target_id AND subscription_enabled;
    IF _seller IS NULL THEN RAISE EXCEPTION 'Subscription not available'; END IF;
    SELECT * INTO _sub FROM circle_subscriptions WHERE circle_id = _target_id AND user_id = _user FOR UPDATE;
    _access := has_circle_subscription(_target_id, _user) OR _seller = _user;
    IF _renew THEN
      IF _sub.expires_at IS NULL THEN RAISE EXCEPTION 'This subscription has no renewal date'; END IF;
      -- Two tabs confirming the same quoted term must not buy two renewals.
      IF _expected_expires_at IS NULL THEN RAISE EXCEPTION 'Renewal quote required'; END IF;
      IF _sub.expires_at IS DISTINCT FROM _expected_expires_at THEN RAISE EXCEPTION 'Subscription changed; refresh renewal quote'; END IF;
    END IF;
    IF NOT _access OR _renew THEN
      _start := CASE WHEN _access THEN GREATEST(now(), _sub.expires_at) ELSE now() END;
      _end := _start + interval '1 month';
      _charged := _price;
    END IF;
  ELSIF _kind IN ('post', 'video') THEN
    IF _renew THEN RAISE EXCEPTION 'Only subscriptions can be renewed'; END IF;
    IF _kind = 'post' THEN
      SELECT user_id, circle_id, premium_price INTO _seller, _circle, _price FROM posts WHERE id = _target_id AND is_premium;
    ELSE
      SELECT user_id, circle_id, price INTO _seller, _circle, _price FROM circle_videos WHERE id = _target_id AND is_premium;
    END IF;
    IF _seller IS NULL THEN RAISE EXCEPTION 'Paid content not found'; END IF;
    _access := circle_content_access(_kind, _target_id, _user);
    IF NOT _access THEN
      IF _circle IS NOT NULL AND NOT can_browse_circle(_circle, _user) THEN RAISE EXCEPTION 'Circle access required'; END IF;
      _charged := _price;
    END IF;
  ELSE RAISE EXCEPTION 'Unsupported purchase kind';
  END IF;

  IF _charged IS NULL OR _charged < 0 OR (_charged = 0 AND NOT _access) THEN RAISE EXCEPTION 'Invalid purchase price'; END IF;
  IF _charged > 0 AND (_expected_price IS NULL OR _expected_price <> _charged) THEN RAISE EXCEPTION 'Price changed; review the current price before purchasing'; END IF;
  IF _charged > 0 THEN
    INSERT INTO coin_wallets(user_id) VALUES (_seller) ON CONFLICT DO NOTHING;
    -- Lock both wallets in a consistent order to avoid opposite-direction deadlocks.
    PERFORM 1 FROM coin_wallets WHERE user_id IN (_user, _seller) ORDER BY user_id FOR UPDATE;
    UPDATE coin_wallets SET balance = balance - _charged, total_spent = total_spent + _charged, updated_at = now()
      WHERE user_id = _user AND balance >= _charged;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient coin balance'; END IF;
    UPDATE coin_wallets SET balance = balance + _charged, total_earned = total_earned + _charged, updated_at = now() WHERE user_id = _seller;
  END IF;
  INSERT INTO circle_payment_requests(user_id, seller_id, request_id, kind, target_id, amount, period_start, period_end)
    VALUES (_user, _seller, _request_id, _kind, _target_id, _charged, _start, _end) RETURNING * INTO _payment;
  IF _charged > 0 THEN
    INSERT INTO coin_transactions(user_id, amount, type, reference_id, description, balance_after)
      SELECT _user, -_charged, CASE WHEN _kind = 'subscription' THEN 'subscription'::coin_transaction_type ELSE 'premium_unlock'::coin_transaction_type END,
        _payment.id, 'Circle ' || _kind, balance FROM coin_wallets WHERE user_id = _user;
    INSERT INTO coin_transactions(user_id, amount, type, reference_id, description, balance_after)
      SELECT _seller, _charged, 'premium_earning', _payment.id, 'Circle ' || _kind, balance FROM coin_wallets WHERE user_id = _seller;
    IF _kind = 'subscription' THEN
      INSERT INTO circle_subscriptions(circle_id, user_id, status, started_at, expires_at, payment_managed, cancel_at_period_end)
        VALUES (_target_id, _user, 'active', _start, _end, true, false)
        ON CONFLICT(circle_id, user_id) DO UPDATE SET status = 'active',
          started_at = LEAST(circle_subscriptions.started_at, EXCLUDED.started_at), expires_at = _end,
          legacy_access_until = CASE WHEN NOT circle_subscriptions.payment_managed AND circle_subscriptions.status = 'active' THEN circle_subscriptions.expires_at ELSE circle_subscriptions.legacy_access_until END,
          payment_managed = true, cancel_at_period_end = false, refunded_at = NULL, updated_at = now();
    ELSIF _kind = 'post' THEN
      INSERT INTO post_unlocks(post_id, user_id, amount_paid, payment_id) VALUES (_target_id, _user, _charged, _payment.id)
        ON CONFLICT(post_id, user_id) DO UPDATE SET refunded_at = NULL, payment_id = _payment.id, amount_paid = _charged;
    ELSE
      INSERT INTO video_unlocks(video_id, user_id, amount_paid, payment_id) VALUES (_target_id, _user, _charged, _payment.id)
        ON CONFLICT(video_id, user_id) DO UPDATE SET refunded_at = NULL, payment_id = _payment.id, amount_paid = _charged;
    END IF;
  END IF;
  RETURN jsonb_build_object('payment_id', _payment.id, 'charged', _charged, 'replayed', false, 'refunded', false, 'has_access', true, 'expires_at', _end);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_circle_subscription(_circle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('circle-payment:' || auth.uid()::text, 0));
  UPDATE circle_subscriptions SET cancel_at_period_end = true, updated_at = now()
    WHERE circle_id = _circle_id AND user_id = auth.uid() AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_circle_payment(_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _payment circle_payment_requests%ROWTYPE;
BEGIN
  SELECT * INTO _payment FROM circle_payment_requests WHERE id = _payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF auth.uid() IS NULL OR (auth.uid() <> _payment.seller_id AND NOT public.is_any_admin(auth.uid())) THEN RAISE EXCEPTION 'Refund not authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('circle-payment:' || _payment.user_id::text, 0));
  SELECT * INTO _payment FROM circle_payment_requests WHERE id = _payment_id FOR UPDATE;
  IF _payment.refunded_at IS NOT NULL THEN RETURN jsonb_build_object('refunded', true, 'replayed', true); END IF;
  IF _payment.amount <= 0 THEN RAISE EXCEPTION 'No charge to refund'; END IF;
  PERFORM 1 FROM coin_wallets WHERE user_id IN (_payment.user_id, _payment.seller_id) ORDER BY user_id FOR UPDATE;
  UPDATE coin_wallets SET balance = balance - _payment.amount, total_earned = total_earned - _payment.amount WHERE user_id = _payment.seller_id AND balance >= _payment.amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Seller balance cannot fund refund'; END IF;
  UPDATE coin_wallets SET balance = balance + _payment.amount, total_spent = total_spent - _payment.amount WHERE user_id = _payment.user_id;
  INSERT INTO coin_transactions(user_id, amount, type, reference_id, description, balance_after)
    SELECT user_id, CASE WHEN user_id = _payment.user_id THEN _payment.amount ELSE -_payment.amount END,
      'refund', _payment.id, 'Circle payment refund', balance FROM coin_wallets WHERE user_id IN (_payment.user_id, _payment.seller_id);
  UPDATE circle_payment_requests SET refunded_at = now() WHERE id = _payment.id;
  UPDATE post_unlocks SET refunded_at = now() WHERE payment_id = _payment.id;
  UPDATE video_unlocks SET refunded_at = now() WHERE payment_id = _payment.id;
  IF _payment.kind='subscription' THEN
    UPDATE circle_subscriptions s SET expires_at=GREATEST(s.legacy_access_until,
      COALESCE((SELECT max(p.period_end) FROM circle_payment_requests p WHERE p.kind='subscription'
        AND p.target_id=s.circle_id AND p.user_id=s.user_id AND p.amount>0 AND p.refunded_at IS NULL),now())),updated_at=now()
      WHERE s.circle_id=_payment.target_id AND s.user_id=_payment.user_id AND s.payment_managed;
  END IF;
  -- A refunded month cannot revoke a different, unrefunded paid month.
  RETURN jsonb_build_object('refunded', true, 'replayed', false);
END;
$$;

-- Compatibility: old post clients use the same atomic purchase path and cannot
-- charge another user. Natural purchase uniqueness makes old retries safe too.
CREATE OR REPLACE FUNCTION public.unlock_premium_post(_user_id uuid, _post_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM purchase_circle_access('post', _post_id, gen_random_uuid(), false, NULL, (SELECT premium_price FROM posts WHERE id = _post_id));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_circle_access(text, uuid, uuid, boolean, timestamptz, integer),
  public.cancel_circle_subscription(uuid), public.refund_circle_payment(uuid), public.unlock_premium_post(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_circle_access(text, uuid, uuid, boolean, timestamptz, integer),
  public.cancel_circle_subscription(uuid), public.refund_circle_payment(uuid), public.unlock_premium_post(uuid, uuid) TO authenticated;

-- Support existing one-time purchases without inventing historical subscription
-- periods. Import only the selected, authorized legacy receipt when refunded.
CREATE FUNCTION public.refund_circle_purchase(_kind text, _content_id uuid, _buyer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _seller uuid; _payment uuid; _receipt uuid; _amount integer;
BEGIN
  IF _kind='post' THEN SELECT user_id INTO _seller FROM posts WHERE id=_content_id;
  ELSIF _kind='video' THEN SELECT user_id INTO _seller FROM circle_videos WHERE id=_content_id;
  ELSE RAISE EXCEPTION 'Unsupported purchase type'; END IF;
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM _seller AND NOT is_any_admin(auth.uid())) THEN RAISE EXCEPTION 'Refund not authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('circle-payment:'||_buyer_id::text,0));
  IF _kind='post' THEN SELECT id,payment_id,amount_paid INTO _receipt,_payment,_amount FROM post_unlocks WHERE post_id=_content_id AND user_id=_buyer_id FOR UPDATE;
  ELSE SELECT id,payment_id,amount_paid INTO _receipt,_payment,_amount FROM video_unlocks WHERE video_id=_content_id AND user_id=_buyer_id FOR UPDATE; END IF;
  IF _receipt IS NULL THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF _payment IS NULL THEN
    IF _amount<=0 THEN RAISE EXCEPTION 'No charge to refund'; END IF;
    INSERT INTO circle_payment_requests(user_id,seller_id,request_id,kind,target_id,amount)
      VALUES(_buyer_id,_seller,_receipt,_kind,_content_id,_amount) RETURNING id INTO _payment;
    IF _kind='post' THEN UPDATE post_unlocks SET payment_id=_payment WHERE id=_receipt;
    ELSE UPDATE video_unlocks SET payment_id=_payment WHERE id=_receipt; END IF;
  END IF;
  RETURN refund_circle_payment(_payment);
END;
$$;
REVOKE ALL ON FUNCTION public.refund_circle_purchase(text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refund_circle_purchase(text,uuid,uuid) TO authenticated;

-- The old subscription flow burned coins via spend_coins (it never credited
-- a creator). Reverse only a real negative legacy ledger receipt, once, under
-- platform-admin authorization; never debit an uninvolved creator wallet.
CREATE TABLE public.circle_legacy_subscription_refunds (
  transaction_id uuid PRIMARY KEY REFERENCES coin_transactions(id),
  user_id uuid NOT NULL REFERENCES profiles(id), circle_id uuid NOT NULL REFERENCES circles(id),
  amount integer NOT NULL CHECK(amount>0), refunded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE circle_legacy_subscription_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_subscription_refund_read ON circle_legacy_subscription_refunds FOR SELECT USING(user_id=auth.uid());
GRANT SELECT ON circle_legacy_subscription_refunds TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON circle_legacy_subscription_refunds FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.refund_legacy_circle_subscription(_transaction_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _t coin_transactions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT is_any_admin(auth.uid()) THEN RAISE EXCEPTION 'Platform admin required'; END IF;
  SELECT * INTO _t FROM coin_transactions WHERE id=_transaction_id AND type='subscription' AND amount<0;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM circle_subscriptions WHERE user_id=_t.user_id AND circle_id=_t.reference_id) THEN RAISE EXCEPTION 'Legacy subscription receipt not found'; END IF;
  IF EXISTS(SELECT 1 FROM circle_payment_requests WHERE id=_t.reference_id) THEN RAISE EXCEPTION 'Use the payment refund API for new subscriptions'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('circle-payment:'||_t.user_id::text,0));
  INSERT INTO circle_legacy_subscription_refunds(transaction_id,user_id,circle_id,amount) VALUES(_t.id,_t.user_id,_t.reference_id,-_t.amount) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE coin_wallets SET balance=balance-_t.amount,total_spent=total_spent+_t.amount WHERE user_id=_t.user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payer wallet not found'; END IF;
  INSERT INTO coin_transactions(user_id,amount,type,reference_id,description,balance_after)
    SELECT user_id,-_t.amount,'refund',_t.id,'Legacy Circle subscription refund',balance FROM coin_wallets WHERE user_id=_t.user_id;
  UPDATE circle_subscriptions SET legacy_access_until=NULL,
    refunded_at=CASE WHEN payment_managed THEN refunded_at ELSE now() END,
    status=CASE WHEN payment_managed THEN status ELSE 'cancelled' END,updated_at=now()
    WHERE circle_id=_t.reference_id AND user_id=_t.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.refund_legacy_circle_subscription(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refund_legacy_circle_subscription(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
