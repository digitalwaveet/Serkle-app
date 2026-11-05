-- READ ONLY. Run as an authorized database operator after the wallet migrations.
-- Do not copy secrets, full bank details or account data into public issues.
-- Investigate provider evidence before any correction; never rewrite ledger rows.

-- 1. Completed scheduler runs, by mode. No recent completion means investigate
-- Cron/pg_net, Edge secrets, missing functions or provider failures.
SELECT mode,max(started_at) AS last_started,max(completed_at) AS last_completed,
  count(*) FILTER(WHERE completed_at IS NULL AND started_at<now()-interval '5 minutes') AS unfinished_runs
FROM wallet_reconciliation_runs GROUP BY mode ORDER BY mode;
SELECT mode,started_at,completed_at,checked,errors
FROM wallet_reconciliation_runs ORDER BY started_at DESC LIMIT 20;

-- 2. Unfulfilled, overdue, conflicting or long-pending receipts, including tests.
-- amount/status alone are never proof of ownership or a reason to mint/refund.
SELECT id,user_id,tx_ref,kind,mode,amount,currency,status,provider_status,
  created_at,verified_at,next_check_at,check_count,review_required,review_code,
  last_error_code,last_error,credited_at,reversed_at,reserved_at,restored_at,submitted_at
FROM chapa_payment_intents
WHERE review_required
  OR (next_check_at<now()-interval '5 minutes' AND reversed_at IS NULL AND restored_at IS NULL)
  OR (kind='topup' AND mode='live' AND provider_status='succeeded' AND credited_at IS NULL AND reversed_at IS NULL)
  OR (kind='withdrawal' AND status='pending' AND created_at<now()-interval '15 minutes')
ORDER BY review_required DESC,created_at;

-- 3. Per-receipt wallet movements must agree with the recorded settlement.
-- Existing before-migration funding is identified by its durable receipt UUID;
-- legacy unbound entries require a separate provider/owner review.
WITH movements AS (
  SELECT p.id,p.user_id,p.tx_ref,p.kind,p.mode,p.status,
    CASE WHEN p.mode='test' THEN 0
      WHEN p.kind='topup' THEN (CASE WHEN p.credited_at IS NOT NULL THEN p.amount ELSE 0 END)-(CASE WHEN p.reversed_at IS NOT NULL AND p.credited_at IS NOT NULL THEN p.amount ELSE 0 END)
      ELSE -(CASE WHEN p.reserved_at IS NOT NULL THEN p.amount ELSE 0 END)+(CASE WHEN p.restored_at IS NOT NULL THEN p.amount ELSE 0 END) END AS expected_delta,
    COALESCE(sum(t.amount),0) AS journal_delta
  FROM chapa_payment_intents p LEFT JOIN coin_transactions t ON t.reference_id=p.id AND t.user_id=p.user_id
  GROUP BY p.id
) SELECT * FROM movements WHERE journal_delta<>expected_delta ORDER BY id;

-- 4. Current balance compared with the preserved baseline plus later journal.
SELECT w.user_id,w.balance,wallet_integrity(w.user_id) AS integrity
FROM coin_wallets w WHERE wallet_integrity(w.user_id)->>'status'<>'balanced';

-- 5. Legacy unbound withdrawals: manual review only, not automatic refunds.
-- The old Edge implementation could debit before recording a provider reference.
SELECT w.* FROM coin_withdrawals w
LEFT JOIN chapa_payment_intents p ON p.id=w.id AND p.kind='withdrawal'
WHERE p.id IS NULL ORDER BY w.id;

-- For a known affected receipt, operators can inspect its immutable event trail
-- with SELECT * FROM wallet_payment_events WHERE payment_id='<receipt UUID>'
-- ORDER BY created_at,id; user-facing receipts are owner-only RPCs, not this script.
