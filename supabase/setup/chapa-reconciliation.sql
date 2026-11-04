-- Apply after the payment migration and Edge deployments. Set these Vault
-- secrets first (not in source control): chapa_project_url and
-- chapa_reconcile_secret. The latter must match CHAPA_RECONCILE_SECRET in Edge.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN
  IF (SELECT count(*) FROM vault.decrypted_secrets WHERE name IN ('chapa_project_url','chapa_reconcile_secret') AND length(decrypted_secret)>0)<>2 THEN
    RAISE EXCEPTION 'Configure the Chapa project URL and reconciliation secret in Vault first';
  END IF;
END $$;
SELECT cron.schedule('serkle-chapa-reconcile','* * * * *',$job$
  SELECT net.http_post(
    url:=(SELECT rtrim(decrypted_secret,'/') FROM vault.decrypted_secrets WHERE name='chapa_project_url')||'/functions/v1/chapa-reconcile',
    headers:=jsonb_build_object('Content-Type','application/json','x-reconcile-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='chapa_reconcile_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=90000
  );
$job$);
