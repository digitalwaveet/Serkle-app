# Supabase project migration

Target project: `fkeyentcklsuqecqgmak` (`eu-west-1`)

Source freeze: 19 November 2026. No new source data should be created until cutover is verified.

Database restore status: verified complete on 19 November 2026. Critical row counts and all audited public tables, functions, policies, triggers, foreign keys, indexes, and Realtime publication memberships match the frozen backup.

## Verified inputs

- `C:\Users\elink\Downloads\heart-lens-studio_261119.backup`
  - PostgreSQL custom archive (`PGDMP`)
  - source PostgreSQL 17.6
  - created by `pg_dump` 18.7
  - includes Auth data, application schemas/data, Storage metadata, Realtime metadata, and migration history
- `C:\Users\elink\Downloads\serkle-storage-setup.sql`
  - bucket and RLS configuration only
  - does **not** contain uploaded Storage object bytes

The database archive already contains 17 Storage buckets and 1,116 `storage.objects` records. Do not run the separate Storage SQL before restoring the database.

## Restore guard

The direct database hostname resolves to IPv6 on this machine and is not reachable. Use the **Session pooler** details shown by Supabase Dashboard > Connect.

First run inspection only:

```powershell
& '.\scripts\supabase-migration\restore-database.ps1' `
  -PoolerHost '<SESSION-POOLER-HOST>'
```

After checking the target ref, host, and user printed by the script, perform the restore:

```powershell
& '.\scripts\supabase-migration\restore-database.ps1' `
  -PoolerHost '<SESSION-POOLER-HOST>' `
  -Execute
```

The script prompts for the **new project database password** using a secure prompt. Do not paste that password into chat or commit it to the repository.

On Windows, `RUN_SUPABASE_RESTORE.cmd` in the repository root runs the same guarded command and keeps the result window open.

If a full restore is interrupted after table data is loaded but before all RLS policies/publications are created, run `RUN_SUPABASE_RESUME_POST_DATA.cmd`. It validates the frozen data counts first, extracts only PostgreSQL's `post-data` archive section, retries missing schema objects without reinserting rows, and verifies final object counts.

The restore intentionally does not use `--clean` and never drops the target database. It first refuses to proceed if the target already has Auth users, Storage objects, or public tables. It disables user triggers in the restore session to avoid duplicate side effects, then validates counts for critical tables.

Expected source counts from the archive:

| Relation | Rows |
| --- | ---: |
| `auth.users` | 21 |
| `auth.identities` | 23 |
| `storage.buckets` | 17 |
| `storage.objects` | 1,116 |
| `public.profiles` | 21 |
| `public.posts` | 81 |
| `public.messages` | 850 |
| `public.circles` | 18 |
| `public.coin_transactions` | 274 |
| `supabase_migrations.schema_migrations` | 47 |

## Cutover status (20 November 2026)

Completed:

- All 19 repository Edge Functions are deployed and report `ACTIVE`.
- Auth site/redirect URLs now allow both production Serkle domains and local port 8082.
- Email OTPs use six digits; phone signup and confirmation are enabled with a
  ten-minute OTP and one-minute resend interval.
- The frontend fallback URL/key and public environment example target the new project.
- Database-triggered push delivery was retargeted to the new Edge Function and
  migration `20261120090000` was recorded as applied.
- The restored Realtime publication has all 10 expected tables.
- Chapa remains deliberately in test mode; its provider/webhook secrets,
  reconciliation secret, webhook endpoint and minute-by-minute reconciliation
  schedule are configured.
- SMTP delivery settings and the signed Send Email Auth Hook are configured.
- Vercel production and preview environments target the new Supabase project;
  the production deployment was verified to contain no retired project URL.

Still required:

1. Transfer the 1,116 actual Storage files. Metadata alone will make files appear in the dashboard but they will return missing-object errors.
2. Finish the Google OAuth client/brand configuration for the new callback URL.
   Serkle does not currently expose GitHub sign-in.
3. Configure AfroMessage and its Send SMS Auth Hook when phone authentication is
   ready to launch. Mapbox remains intentionally deferred as well.
4. Add the Lovable AI key only if those retained AI functions are still required.
5. Run end-to-end signup, recovery, Storage, messaging, push, wallet and payment checks.
6. Keep the old project intact until the new project passes verification and rollback is no longer needed.
