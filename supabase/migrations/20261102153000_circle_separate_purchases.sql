-- Events/services are explicitly excluded from subscriptions. Their existing
-- purchase buttons must also debit and register/book atomically, exactly once.
CREATE TABLE public.circle_booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(id),
  seller_id uuid NOT NULL REFERENCES profiles(id), request_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('event','service')), target_id uuid NOT NULL,
  booking_id uuid NOT NULL, amount integer NOT NULL CHECK(amount >= 0),
  details jsonb NOT NULL DEFAULT '{}', refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,request_id)
);
ALTER TABLE circle_booking_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_payment_read ON circle_booking_payments FOR SELECT USING(user_id=auth.uid() OR seller_id=auth.uid());
GRANT SELECT ON circle_booking_payments TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON circle_booking_payments FROM anon,authenticated;
REVOKE INSERT,DELETE,UPDATE ON circle_event_attendees, circle_service_bookings FROM anon,authenticated;

CREATE FUNCTION public.can_access_circle_event(_id uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM circle_events e WHERE e.id=_id AND (
    e.creator_id=_user OR (COALESCE(e.price,0)=0 AND can_browse_circle(e.circle_id,_user))
    OR EXISTS(SELECT 1 FROM circle_event_attendees a WHERE a.event_id=e.id AND a.user_id=_user AND a.payment_status='paid')
  ));
$$;
CREATE POLICY paid_event_payload_guard ON circle_events AS RESTRICTIVE FOR SELECT USING(can_access_circle_event(id,auth.uid()));
CREATE FUNCTION public.get_circle_events(_circle_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(e) || jsonb_build_object(
    'meeting_url', CASE WHEN can_access_circle_event(e.id,auth.uid()) THEN e.meeting_url END,
    'recording_url', CASE WHEN can_access_circle_event(e.id,auth.uid()) THEN e.recording_url END,
    'circle_event_attendees', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',a.user_id)) FROM circle_event_attendees a WHERE a.event_id=e.id AND a.status <> 'cancelled'),'[]'::jsonb)
  ) ORDER BY e.event_date), '[]'::jsonb) FROM circle_events e WHERE e.circle_id=_circle_id AND can_browse_circle(e.circle_id,auth.uid());
$$;

CREATE FUNCTION public.purchase_circle_booking(_kind text, _target_id uuid, _request_id uuid, _expected_price integer, _details jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _user uuid:=auth.uid(); _seller uuid; _circle uuid; _price numeric; _booking uuid;
  _old circle_booking_payments%ROWTYPE; _charged integer:=0;
BEGIN
  IF _user IS NULL OR _request_id IS NULL THEN RAISE EXCEPTION 'Authentication and request ID required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('circle-payment:'||_user::text,0));
  SELECT * INTO _old FROM circle_booking_payments WHERE user_id=_user AND request_id=_request_id;
  IF FOUND THEN
    IF _old.kind<>_kind OR _old.target_id<>_target_id OR _old.details<>_details THEN RAISE EXCEPTION 'Idempotency key reused for another booking'; END IF;
    RETURN jsonb_build_object('booking_id',_old.booking_id,'charged',0,'replayed',true,'refunded',_old.refunded_at IS NOT NULL);
  END IF;
  IF _kind='event' THEN
    SELECT creator_id,circle_id,COALESCE(price,0) INTO _seller,_circle,_price FROM circle_events WHERE id=_target_id AND status='upcoming' FOR UPDATE;
    SELECT id INTO _booking FROM circle_event_attendees WHERE event_id=_target_id AND user_id=_user AND payment_status='paid';
    IF _booking IS NOT NULL THEN
      UPDATE circle_event_attendees SET status='registered' WHERE id=_booking;
      RETURN jsonb_build_object('booking_id',_booking,'charged',0,'replayed',true,'refunded',false);
    END IF;
  ELSIF _kind='service' THEN
    SELECT provider_id,circle_id,price INTO _seller,_circle,_price FROM circle_services WHERE id=_target_id AND is_active;
    IF COALESCE(_details->>'member_name','')='' OR COALESCE(_details->>'member_email','')='' OR COALESCE(_details->>'booking_date','')='' OR COALESCE(_details->>'booking_time','')='' THEN RAISE EXCEPTION 'Booking details required'; END IF;
    SELECT id INTO _booking FROM circle_service_bookings WHERE service_id=_target_id AND user_id=_user
      AND booking_date=(_details->>'booking_date')::date AND booking_time=(_details->>'booking_time')::time AND payment_status='paid' AND status<>'cancelled';
    IF _booking IS NOT NULL THEN RETURN jsonb_build_object('booking_id',_booking,'charged',0,'replayed',true,'refunded',false); END IF;
  ELSE RAISE EXCEPTION 'Unsupported booking type'; END IF;
  IF _seller IS NULL OR NOT can_browse_circle(_circle,_user) THEN RAISE EXCEPTION 'Booking unavailable'; END IF;
  IF _price<0 OR _price<>trunc(_price) OR _price IS NULL OR _expected_price IS DISTINCT FROM _price THEN RAISE EXCEPTION 'Review the current whole-coin price'; END IF;
  IF _kind='event' AND EXISTS(SELECT 1 FROM circle_events e WHERE e.id=_target_id AND e.max_attendees IS NOT NULL AND e.max_attendees <= (SELECT count(*) FROM circle_event_attendees a WHERE a.event_id=e.id AND a.status<>'cancelled')) THEN RAISE EXCEPTION 'Event is full'; END IF;
  _booking:=gen_random_uuid();
  IF _price>0 AND _seller<>_user THEN
    PERFORM 1 FROM coin_wallets WHERE user_id IN (_user,_seller) ORDER BY user_id FOR UPDATE;
    IF NOT transfer_coins_internal(_user,_seller,_price::integer,
      CASE WHEN _kind='event' THEN 'event_payment'::coin_transaction_type ELSE 'service_payment'::coin_transaction_type END,
      CASE WHEN _kind='event' THEN 'event_earned'::coin_transaction_type ELSE 'service_earned'::coin_transaction_type END,
      _booking,'Circle '||_kind||' purchase') THEN RAISE EXCEPTION 'Insufficient coin balance'; END IF;
    _charged:=_price::integer;
  END IF;
  IF _kind='event' THEN
    INSERT INTO circle_event_attendees(id,event_id,user_id,status,payment_status) VALUES(_booking,_target_id,_user,'registered','paid')
      ON CONFLICT(event_id,user_id) DO UPDATE SET status='registered',payment_status='paid' RETURNING id INTO _booking;
  ELSE
    INSERT INTO circle_service_bookings(id,service_id,user_id,booking_date,booking_time,member_name,member_email,member_phone,notes,payment_status,status)
      VALUES(_booking,_target_id,_user,(_details->>'booking_date')::date,(_details->>'booking_time')::time,_details->>'member_name',_details->>'member_email',_details->>'member_phone',_details->>'notes','paid','pending');
  END IF;
  INSERT INTO circle_booking_payments(user_id,seller_id,request_id,kind,target_id,booking_id,amount,details)
    VALUES(_user,_seller,_request_id,_kind,_target_id,_booking,_charged,_details);
  RETURN jsonb_build_object('booking_id',_booking,'charged',_charged,'replayed',false,'refunded',false);
END;
$$;

CREATE FUNCTION public.cancel_circle_event_registration(_event_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE circle_event_attendees SET status='cancelled' WHERE event_id=_event_id AND user_id=auth.uid();
$$;
CREATE FUNCTION public.refund_circle_booking(_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _p circle_booking_payments%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM circle_booking_payments WHERE id=_payment_id;
  IF NOT FOUND OR auth.uid() IS NULL OR (auth.uid()<>_p.seller_id AND NOT is_any_admin(auth.uid())) THEN RAISE EXCEPTION 'Refund not authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('circle-payment:'||_p.user_id::text,0));
  SELECT * INTO _p FROM circle_booking_payments WHERE id=_payment_id FOR UPDATE;
  IF _p.refunded_at IS NOT NULL THEN RETURN; END IF;
  IF _p.amount>0 THEN
    PERFORM 1 FROM coin_wallets WHERE user_id IN (_p.user_id,_p.seller_id) ORDER BY user_id FOR UPDATE;
    UPDATE coin_wallets SET balance=balance-_p.amount,total_earned=total_earned-_p.amount WHERE user_id=_p.seller_id AND balance>=_p.amount;
    IF NOT FOUND THEN RAISE EXCEPTION 'Seller balance cannot fund refund'; END IF;
    UPDATE coin_wallets SET balance=balance+_p.amount,total_spent=total_spent-_p.amount WHERE user_id=_p.user_id;
    INSERT INTO coin_transactions(user_id,amount,type,reference_id,description,balance_after)
      SELECT user_id,CASE WHEN user_id=_p.user_id THEN _p.amount ELSE -_p.amount END,'refund',_p.id,'Circle booking refund',balance
      FROM coin_wallets WHERE user_id IN (_p.user_id,_p.seller_id);
  END IF;
  UPDATE circle_booking_payments SET refunded_at=now() WHERE id=_p.id;
  IF _p.kind='event' THEN UPDATE circle_event_attendees SET payment_status='refunded',status='cancelled' WHERE id=_p.booking_id;
  ELSE UPDATE circle_service_bookings SET payment_status='refunded',status='cancelled' WHERE id=_p.booking_id; END IF;
END;
$$;

-- Recordings share the resource bucket but have their own paid-event grant.
CREATE OR REPLACE FUNCTION public.can_read_circle_storage(_bucket text, _name text, _user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF _bucket='circle-videos' THEN RETURN EXISTS(SELECT 1 FROM circle_videos v WHERE
    (circle_storage_path(v.video_url,_bucket)=_name AND circle_content_access('video',v.id,_user)) OR
    (circle_storage_path(v.thumbnail_url,_bucket)=_name AND can_browse_circle(v.circle_id,_user)));
  ELSIF _bucket='circle-resources' THEN RETURN EXISTS(SELECT 1 FROM circle_resources r WHERE circle_storage_path(r.file_url,_bucket)=_name AND circle_content_access('resource',r.id,_user))
    OR EXISTS(SELECT 1 FROM circle_events e WHERE circle_storage_path(e.recording_url,_bucket)=_name AND can_access_circle_event(e.id,_user));
  ELSIF _bucket='post-media' THEN RETURN NOT EXISTS(SELECT 1 FROM posts p WHERE p.circle_id IS NOT NULL AND p.is_premium
    AND EXISTS(SELECT 1 FROM unnest(COALESCE(p.media_urls,'{}'::text[])||ARRAY[p.media_url,p.cover_image_url,p.voice_url,p.original_pdf_url]) u WHERE circle_storage_path(u,_bucket)=_name)
    AND NOT circle_content_access('post',p.id,_user)); END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_circle_booking(text,uuid,uuid,integer,jsonb), public.cancel_circle_event_registration(uuid),public.refund_circle_booking(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_circle_booking(text,uuid,uuid,integer,jsonb), public.cancel_circle_event_registration(uuid),public.refund_circle_booking(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
