-- Positive current balances measure spendable coins held by users.
-- Chargeback debt, test receipts and reserved withdrawal funds are not circulating coins.
CREATE INDEX IF NOT EXISTS coin_wallets_positive_holder_rank
  ON public.coin_wallets (balance DESC, user_id DESC) WHERE balance > 0;

CREATE FUNCTION public.get_admin_coin_holdings(
  _before_balance integer DEFAULT NULL,
  _before_user_id uuid DEFAULT NULL,
  _limit integer DEFAULT 10
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT COALESCE(public.has_role(auth.uid(), 'super_admin'), false) THEN
    RAISE EXCEPTION 'Super admin access required' USING ERRCODE = '42501';
  END IF;
  IF (_before_balance IS NULL) <> (_before_user_id IS NULL) OR _before_balance <= 0
    OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Invalid coin holder page' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'checked_at', statement_timestamp(),
    'summary', (SELECT jsonb_build_object(
      'circulating_coins', COALESCE(sum(w.balance), 0)::text,
      'holders', count(*)::text
    ) FROM public.coin_wallets w WHERE w.balance > 0),
    'items', (SELECT COALESCE(jsonb_agg(to_jsonb(holder) ORDER BY holder.balance DESC, holder.user_id DESC), '[]'::jsonb)
      FROM (
        SELECT w.user_id, w.balance, p.name, p.username
        FROM public.coin_wallets w
        LEFT JOIN public.profiles p ON p.id = w.user_id
        WHERE w.balance > 0 AND (_before_balance IS NULL OR (w.balance, w.user_id) < (_before_balance, _before_user_id))
        ORDER BY w.balance DESC, w.user_id DESC
        LIMIT _limit + 1
      ) holder)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_coin_holdings(integer, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_coin_holdings(integer, uuid, integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
