-- A retried gift is the same operation until its server result is received.
-- Successful repeated gifts remain possible with a new explicit request ID.
CREATE TABLE public.wallet_tip_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id),
  request_id uuid NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed','failed')),
  result boolean,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,request_id)
);
ALTER TABLE wallet_tip_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallet_tip_owner_read ON wallet_tip_requests FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON wallet_tip_requests FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON wallet_tip_requests TO authenticated,service_role;
ALTER TABLE coin_transactions ADD COLUMN operation_id uuid REFERENCES wallet_tip_requests(id);
CREATE FUNCTION public.guard_wallet_tip_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.status<>'processing' OR NEW.payload IS DISTINCT FROM OLD.payload OR NEW.user_id<>OLD.user_id OR NEW.request_id<>OLD.request_id OR NEW.id<>OLD.id THEN
    RAISE EXCEPTION 'Recorded wallet requests cannot be changed' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER wallet_tip_request_immutable BEFORE UPDATE OR DELETE ON wallet_tip_requests FOR EACH ROW EXECUTE FUNCTION guard_wallet_tip_request();
CREATE FUNCTION public.link_wallet_tip_journal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE operation_key text:=NULLIF(current_setting('serkle.wallet_tip',true),''); p wallet_tip_requests;
BEGIN
  IF operation_key IS NOT NULL THEN
    SELECT * INTO p FROM wallet_tip_requests WHERE id=operation_key::uuid;
    IF NOT FOUND OR p.status<>'processing' OR NOT(
      (NEW.user_id=p.user_id AND NEW.type::text='tip_sent' AND NEW.amount=-(p.payload->>'amount')::integer) OR
      (NEW.user_id=(p.payload->>'receiver')::uuid AND NEW.type::text='tip_received' AND NEW.amount=(p.payload->>'amount')::integer)) THEN RAISE EXCEPTION 'Wallet operation journal mismatch'; END IF;
    NEW.operation_id:=p.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER wallet_tip_journal_link BEFORE INSERT ON coin_transactions FOR EACH ROW EXECUTE FUNCTION link_wallet_tip_journal();
CREATE FUNCTION public.wallet_transfer_tip(_request_id uuid,_receiver_id uuid,_amount numeric,_reference_id uuid DEFAULT NULL,_description text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner_id uuid:=auth.uid(); p wallet_tip_requests; body jsonb; outcome boolean;
BEGIN
  IF owner_id IS NULL OR _request_id IS NULL OR _receiver_id IS NULL OR owner_id=_receiver_id OR _amount IS NULL OR _amount<>trunc(_amount) OR _amount<1 OR _amount>1000000 THEN RAISE EXCEPTION 'Invalid tip request'; END IF;
  IF EXISTS(SELECT 1 FROM chapa_payment_intents WHERE id=_reference_id) THEN RAISE EXCEPTION 'Payment receipt references cannot be used for tips'; END IF;
  body:=jsonb_build_object('receiver',_receiver_id,'amount',_amount,'reference',_reference_id,'description',left(COALESCE(_description,''),500));
  PERFORM pg_advisory_xact_lock(hashtextextended('wallet-tip:'||owner_id::text,0));
  SELECT * INTO p FROM wallet_tip_requests WHERE user_id=owner_id AND request_id=_request_id;
  IF FOUND THEN
    IF p.payload<>body THEN RAISE EXCEPTION 'Idempotency key reused for a different tip'; END IF;
    RETURN jsonb_build_object('userId',owner_id,'operationId',p.id,'success',p.result,'replayed',true);
  END IF;
  INSERT INTO wallet_tip_requests(user_id,request_id,payload) VALUES(owner_id,_request_id,body) RETURNING * INTO p;
  INSERT INTO coin_wallets(user_id) SELECT id FROM (VALUES(owner_id),(_receiver_id)) target(id) ORDER BY id ON CONFLICT DO NOTHING;
  PERFORM 1 FROM coin_wallets WHERE user_id IN (owner_id,_receiver_id) ORDER BY user_id FOR UPDATE;
  PERFORM set_config('serkle.wallet_tip',p.id::text,true);
  outcome:=transfer_coins_internal(owner_id,_receiver_id,_amount::integer,'tip_sent','tip_received',_reference_id,left(COALESCE(_description,''),500));
  PERFORM set_config('serkle.wallet_tip','',true);
  UPDATE wallet_tip_requests SET status=CASE WHEN outcome THEN 'completed' ELSE 'failed' END,result=outcome WHERE id=p.id;
  RETURN jsonb_build_object('userId',owner_id,'operationId',p.id,'success',outcome,'replayed',false);
END;
$$;
REVOKE ALL ON FUNCTION guard_wallet_tip_request(),link_wallet_tip_journal(),wallet_transfer_tip(uuid,uuid,numeric,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION wallet_transfer_tip(uuid,uuid,numeric,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION transfer_coins(uuid,uuid,integer,coin_transaction_type,coin_transaction_type,uuid,text) FROM authenticated;
NOTIFY pgrst,'reload schema';
