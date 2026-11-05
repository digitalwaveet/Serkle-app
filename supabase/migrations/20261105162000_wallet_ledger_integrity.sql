-- Preserve existing opening balances, then require every future balance change
-- to match its append-only journal in the same database transaction. Sequence
-- ordering avoids backdated timestamps bypassing the accounting baseline.
ALTER TABLE coin_transactions ADD COLUMN journal_sequence bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX wallet_journal_sequence ON coin_transactions(journal_sequence);
CREATE INDEX wallet_journal_accounting ON coin_transactions(user_id,journal_sequence) INCLUDE(amount);
CREATE TABLE public.wallet_accounting_baselines (
  user_id uuid PRIMARY KEY REFERENCES profiles(id),
  balance bigint NOT NULL,
  journal_sequence bigint NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE wallet_accounting_baselines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wallet_accounting_baselines FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON wallet_accounting_baselines TO service_role;
DO $$ BEGIN
  LOCK TABLE coin_wallets,coin_transactions IN SHARE ROW EXCLUSIVE MODE;
  INSERT INTO wallet_accounting_baselines(user_id,balance,journal_sequence)
    SELECT w.user_id,w.balance,COALESCE(max(t.journal_sequence),0) FROM coin_wallets w
    LEFT JOIN coin_transactions t ON t.user_id=w.user_id GROUP BY w.user_id,w.balance;
END $$;
CREATE TRIGGER wallet_baseline_immutable BEFORE UPDATE OR DELETE ON wallet_accounting_baselines FOR EACH ROW EXECUTE FUNCTION wallet_event_immutable();
CREATE TRIGGER wallet_ledger_immutable BEFORE UPDATE OR DELETE ON coin_transactions FOR EACH ROW EXECUTE FUNCTION wallet_event_immutable();

CREATE FUNCTION public.wallet_integrity(_user_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH baseline AS (SELECT balance,journal_sequence,captured_at FROM wallet_accounting_baselines WHERE user_id=_user_id),
  expected AS (SELECT COALESCE((SELECT balance FROM baseline),0)+COALESCE(sum(amount),0) AS balance FROM coin_transactions
    WHERE user_id=_user_id AND journal_sequence>COALESCE((SELECT journal_sequence FROM baseline),0)),
  actual AS (SELECT balance FROM coin_wallets WHERE user_id=_user_id)
  SELECT jsonb_build_object('status',CASE WHEN COALESCE((SELECT balance FROM actual),0)=(SELECT balance FROM expected) THEN 'balanced' ELSE 'needs_review' END,
    'recordedBalance',(SELECT balance FROM actual),'expectedBalance',(SELECT balance FROM expected),'baselineAt',(SELECT captured_at FROM baseline));
$$;
REVOKE ALL ON FUNCTION wallet_integrity(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION wallet_integrity(uuid) TO service_role;

CREATE FUNCTION public.enforce_wallet_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner_id uuid:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
BEGIN
  IF wallet_integrity(owner_id)->>'status'<>'balanced' THEN RAISE EXCEPTION 'Wallet balance does not match its recorded movements' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION enforce_wallet_integrity() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER wallet_balance_consistency AFTER INSERT OR UPDATE OR DELETE ON coin_wallets
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_wallet_integrity();
CREATE CONSTRAINT TRIGGER wallet_journal_consistency AFTER INSERT ON coin_transactions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_wallet_integrity();

CREATE OR REPLACE FUNCTION public.get_wallet_activity(_before_created_at timestamptz DEFAULT NULL,_before_id uuid DEFAULT NULL,_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF _limit IS NULL OR _limit<1 OR _limit>50 OR (_before_created_at IS NULL)<>(_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid activity page'; END IF;
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC) INTO rows FROM (
    SELECT * FROM coin_transactions WHERE user_id=auth.uid()
      AND (_before_created_at IS NULL OR (created_at,id)<(_before_created_at,_before_id)) ORDER BY created_at DESC,id DESC LIMIT _limit+1
  ) t;
  RETURN jsonb_build_object('userId',auth.uid(),'items',COALESCE(rows,'[]'),'integrity',wallet_integrity(auth.uid()));
END;
$$;
NOTIFY pgrst,'reload schema';
