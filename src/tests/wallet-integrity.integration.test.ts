import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('accounting migration preserves legacy opening balances and enforces later journal changes atomically, including backdated entries', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
      CREATE TABLE profiles(id uuid PRIMARY KEY); INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001');
      CREATE TABLE coin_wallets(user_id uuid PRIMARY KEY REFERENCES profiles(id),balance integer);
      CREATE TABLE coin_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,amount integer,created_at timestamptz DEFAULT now());
      INSERT INTO coin_wallets VALUES('00000000-0000-0000-0000-000000000001',200);
      INSERT INTO coin_transactions(user_id,amount) VALUES('00000000-0000-0000-0000-000000000001',50);`);
    const audit = await readFile(new URL('../../supabase/migrations/20261105160000_wallet_payment_audit.sql', import.meta.url), 'utf8');
    await db.exec(audit.match(/CREATE FUNCTION public\.wallet_event_immutable\(\)[\s\S]*?\$\$;/)![0]);
    await db.exec(await readFile(new URL('../../supabase/migrations/20261105162000_wallet_ledger_integrity.sql', import.meta.url), 'utf8'));
    let state = (await db.query<any>('SELECT wallet_integrity(auth.uid()) result')).rows[0].result;
    assert.equal(state.recordedBalance, 200);assert.equal(state.expectedBalance, 200);assert.equal(state.status, 'balanced');
    await assert.rejects(db.exec('UPDATE coin_wallets SET balance=201'), /does not match/);
    await db.exec(`BEGIN; UPDATE coin_wallets SET balance=210;
      INSERT INTO coin_transactions(user_id,amount,created_at) VALUES('00000000-0000-0000-0000-000000000001',10,'2020-01-01T00:00:00Z'); COMMIT;`);
    state = (await db.query<any>('SELECT wallet_integrity(auth.uid()) result')).rows[0].result;
    assert.equal(state.recordedBalance, 210);assert.equal(state.expectedBalance, 210);assert.equal(state.status, 'balanced');
    assert.equal((await db.query<any>('SELECT count(*)::integer n FROM coin_transactions')).rows[0].n, 2);
    await assert.rejects(db.exec('DELETE FROM coin_transactions'), /cannot be edited or deleted/);
    await assert.rejects(db.exec('UPDATE wallet_accounting_baselines SET balance=0'), /cannot be edited or deleted/);
  } finally { await db.close(); }
});
