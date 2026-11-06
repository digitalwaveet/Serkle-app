-- Product owner approved a temporary Shop coin-payment pause. An old browser
-- must not burn coins before saving an order. Bound Circle purchases and tips
-- use separate server endpoints and are unaffected.
CREATE OR REPLACE FUNCTION public.spend_coins(_user_id uuid,_amount integer,_type public.coin_transaction_type,_reference_id uuid DEFAULT NULL,_description text DEFAULT '')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Shop coin payments are temporarily unavailable. Choose another payment method.' USING ERRCODE='42501';
END;
$$;
REVOKE ALL ON FUNCTION public.spend_coins(uuid,integer,public.coin_transaction_type,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
