import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrationUrl = new URL('../../supabase/migrations/20261120143000_auth_email_outbox.sql', import.meta.url);
const roleMigrationUrl = new URL('../../supabase/migrations/20261127143000_fix_auth_email_outbox_role.sql', import.meta.url);

async function database() {
  const db = new PGlite();
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$;
  `);
  await db.exec(await readFile(migrationUrl, 'utf8'));
  await db.exec(await readFile(roleMigrationUrl, 'utf8'));
  await db.exec('SET ROLE service_role');
  return db;
}

test('auth email outbox claims once and scrubs OTP content after delivery', async () => {
  const db = await database();
  try {
    await db.query(`
      insert into public.auth_email_outbox
        (webhook_id, message_index, recipient, subject, html, text_body, message_id)
      values
        ('hook-1', 0, 'member@example.com', 'Verify', '<b>123456</b>', 'Code 123456', '<id@example.com>')
      on conflict (webhook_id, message_index) do nothing
    `);
    await db.query(`
      insert into public.auth_email_outbox
        (webhook_id, message_index, recipient, subject, html, text_body, message_id)
      values
        ('hook-1', 0, 'member@example.com', 'Verify', '<b>123456</b>', 'Code 123456', '<id@example.com>')
      on conflict (webhook_id, message_index) do nothing
    `);

    const workerId = '11111111-1111-4111-8111-111111111111';
    const claimed = await db.query<{ id: string; recipient: string; text_body: string }>(
      `select * from public.claim_auth_email_outbox($1::uuid, 4)`,
      [workerId],
    );
    assert.equal(claimed.rows.length, 1);
    assert.equal(claimed.rows[0].recipient, 'member@example.com');
    assert.match(claimed.rows[0].text_body, /123456/);

    await db.query(`select public.complete_auth_email_outbox($1::uuid, $2::uuid, null)`, [
      claimed.rows[0].id,
      workerId,
    ]);
    const stored = await db.query<{ status: string; recipient: string | null; text_body: string | null }>(
      `select status, recipient, text_body from public.auth_email_outbox`,
    );
    assert.deepEqual(stored.rows, [{ status: 'sent', recipient: null, text_body: null }]);
  } finally {
    await db.close();
  }
});

test('failed delivery releases its lease for a bounded retry', async () => {
  const db = await database();
  try {
    await db.query(`
      insert into public.auth_email_outbox
        (webhook_id, message_index, recipient, subject, html, text_body, message_id)
      values ('hook-2', 0, 'member@example.com', 'Reset', '<b>654321</b>', 'Code 654321', '<id2@example.com>')
    `);
    const workerId = '22222222-2222-4222-8222-222222222222';
    const claimed = await db.query<{ id: string }>(
      `select * from public.claim_auth_email_outbox($1::uuid, 4)`,
      [workerId],
    );
    await db.query(`select public.complete_auth_email_outbox($1::uuid, $2::uuid, $3)`, [
      claimed.rows[0].id,
      workerId,
      'temporary SMTP failure',
    ]);
    const stored = await db.query<{
      status: string;
      attempts: number;
      lease_token: string | null;
      last_error: string;
      recipient: string;
    }>(`select status, attempts, lease_token, last_error, recipient from public.auth_email_outbox`);
    assert.equal(stored.rows[0].status, 'pending');
    assert.equal(stored.rows[0].attempts, 1);
    assert.equal(stored.rows[0].lease_token, null);
    assert.equal(stored.rows[0].last_error, 'temporary SMTP failure');
    assert.equal(stored.rows[0].recipient, 'member@example.com');
  } finally {
    await db.close();
  }
});
