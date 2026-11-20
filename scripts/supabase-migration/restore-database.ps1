[CmdletBinding()]
param(
  [string]$BackupPath = 'C:\Users\elink\Downloads\heart-lens-studio_261119.backup',
  [Parameter(Mandatory = $true)]
  [string]$PoolerHost,
  [int]$Port = 5432,
  [string]$DatabaseName = 'postgres',
  [string]$DatabaseUser = 'postgres.fkeyentcklsuqecqgmak',
  [string]$PgBin = 'C:\Users\elink\AppData\Local\Temp\serkle-pg17-client\pgsql\bin',
  [switch]$Execute
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$expectedProjectRef = 'fkeyentcklsuqecqgmak'
$expectedDatabaseUser = "postgres.$expectedProjectRef"
$pgRestore = Join-Path $PgBin 'pg_restore.exe'
$psql = Join-Path $PgBin 'psql.exe'

if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) {
  throw "Backup not found: $BackupPath"
}

if (-not (Test-Path -LiteralPath $pgRestore -PathType Leaf)) {
  throw "pg_restore was not found at $pgRestore"
}

if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) {
  throw "psql was not found at $psql"
}

if ($DatabaseUser -ne $expectedDatabaseUser) {
  throw "Refusing to target an unexpected pooler user. Expected '$expectedDatabaseUser'."
}

$header = [System.IO.File]::ReadAllBytes($BackupPath)[0..4]
$signature = [System.Text.Encoding]::ASCII.GetString($header)
if ($signature -ne 'PGDMP') {
  throw 'The supplied backup is not a PostgreSQL custom archive (PGDMP).'
}

$restoreVersion = (& $pgRestore --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $restoreVersion -notmatch 'PostgreSQL\) 17\.') {
  throw "PostgreSQL 17 pg_restore is required. Found: $restoreVersion"
}

& $pgRestore --list $BackupPath | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'pg_restore could not read the backup table of contents.'
}

Write-Host "Backup:       $BackupPath"
Write-Host "Target ref:   $expectedProjectRef"
Write-Host "Pooler host:  $PoolerHost"
Write-Host "Pooler user:  $DatabaseUser"
Write-Host "Postgres:     $restoreVersion"

if (-not $Execute) {
  Write-Host ''
  Write-Host 'Inspection passed. No database connection or restore was attempted.'
  Write-Host 'Run again with -Execute only after confirming the session-pooler host.'
  exit 0
}

$securePassword = Read-Host 'Enter the NEW Supabase database password' -AsSecureString
$passwordPointer = [IntPtr]::Zero
$plainPassword = $null
$previousPgPassword = $env:PGPASSWORD

try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:PGPASSWORD = $plainPassword

  $connectionArgs = @(
    "--host=$PoolerHost"
    "--port=$Port"
    "--username=$DatabaseUser"
    "--dbname=$DatabaseName"
    '--no-password'
    '--pset=pager=off'
  )

  Write-Host 'Testing the new Supabase database connection...'
  & $psql @connectionArgs --tuples-only --no-align --command "select current_database() || '|' || current_user || '|' || current_setting('server_version');"
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not connect to the new Supabase database. Nothing was restored.'
  }

  $preflightSql = @'
select
  (select count(*) from auth.users)::text || '|' ||
  (select count(*) from storage.objects)::text || '|' ||
  (select count(*) from pg_tables where schemaname = 'public')::text;
'@
  $preflight = (& $psql @connectionArgs --set ON_ERROR_STOP=1 --tuples-only --no-align --command $preflightSql | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $preflight -notmatch '^(\d+)\|(\d+)\|(\d+)$') {
    throw 'Could not verify that the target project is empty. Nothing was restored.'
  }

  $existingAuthUsers = [long]$matches[1]
  $existingStorageObjects = [long]$matches[2]
  $existingPublicTables = [long]$matches[3]
  if ($existingAuthUsers -ne 0 -or $existingStorageObjects -ne 0 -or $existingPublicTables -ne 0) {
    throw "Refusing to restore into a non-empty project (auth users: $existingAuthUsers, storage objects: $existingStorageObjects, public tables: $existingPublicTables)."
  }

  Write-Host 'Target emptiness check passed.'

  $workingRoot = Join-Path $env:TEMP 'serkle-supabase-migration'
  $logRoot = Join-Path $workingRoot 'logs'
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $sqlPath = Join-Path $workingRoot 'heart-lens-studio_261119.restore.sql'
  $logPath = Join-Path $logRoot "database-restore-$timestamp.log"

  Write-Host "Expanding the custom archive to temporary SQL: $sqlPath"
  & $pgRestore --no-owner --file=$sqlPath $BackupPath
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not expand the PostgreSQL archive. The database was not changed.'
  }

  Write-Host 'Starting restore with user triggers disabled for the restore session...'
  Write-Host "Restore log: $logPath"

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # A full Supabase dashboard backup contains managed auth/storage objects that
    # already exist in a new project. psql must continue past those expected
    # SQL errors so later application schemas and data can still be restored.
    $ErrorActionPreference = 'Continue'
    & $psql @connectionArgs `
      --command 'SET session_replication_role = replica;' `
      --file $sqlPath `
      --command 'SET session_replication_role = origin;' 2>&1 |
      Tee-Object -FilePath $logPath
    $restoreExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $restoreErrorCount = (Select-String -LiteralPath $logPath -Pattern '^psql:.*ERROR:' -ErrorAction SilentlyContinue).Count

  Write-Host 'Running post-restore count checks...'
  $verificationSql = @'
select 'auth.users' as relation, count(*)::bigint as rows from auth.users
union all select 'auth.identities', count(*)::bigint from auth.identities
union all select 'storage.buckets', count(*)::bigint from storage.buckets
union all select 'storage.objects', count(*)::bigint from storage.objects
union all select 'public.profiles', count(*)::bigint from public.profiles
union all select 'public.posts', count(*)::bigint from public.posts
union all select 'public.messages', count(*)::bigint from public.messages
union all select 'public.circles', count(*)::bigint from public.circles
union all select 'public.coin_transactions', count(*)::bigint from public.coin_transactions
union all select 'supabase_migrations.schema_migrations', count(*)::bigint from supabase_migrations.schema_migrations
order by relation;
'@
  $verificationOutput = & $psql @connectionArgs --set ON_ERROR_STOP=1 --tuples-only --no-align --command $verificationSql
  if ($LASTEXITCODE -ne 0) {
    throw "Restore verification failed. Inspect $logPath before retrying."
  }

  $expectedCounts = @{
    'auth.users' = 21L
    'auth.identities' = 23L
    'storage.buckets' = 17L
    'storage.objects' = 1116L
    'public.profiles' = 21L
    'public.posts' = 81L
    'public.messages' = 850L
    'public.circles' = 18L
    'public.coin_transactions' = 274L
    'supabase_migrations.schema_migrations' = 47L
  }

  $actualCounts = @{}
  foreach ($line in $verificationOutput) {
    if ($line -match '^([^|]+)\|(\d+)$') {
      $actualCounts[$matches[1]] = [long]$matches[2]
      Write-Host ("{0,-40} {1,8}" -f $matches[1], $matches[2])
    }
  }

  $countMismatches = @()
  foreach ($relation in $expectedCounts.Keys) {
    if (-not $actualCounts.ContainsKey($relation)) {
      $countMismatches += "$relation was not returned by verification"
    }
    elseif ($actualCounts[$relation] -ne $expectedCounts[$relation]) {
      $countMismatches += "$relation expected $($expectedCounts[$relation]), found $($actualCounts[$relation])"
    }
  }

  if ($countMismatches.Count -gt 0) {
    $message = $countMismatches -join '; '
    throw "Restored row counts do not match the frozen backup: $message. Inspect $logPath before retrying."
  }

  if ($restoreErrorCount -gt 0) {
    Write-Warning "The restore log contains $restoreErrorCount SQL errors. Existing Supabase-managed objects commonly cause these; review the log before proceeding."
  }

  if ($restoreExitCode -ne 0) {
    Write-Warning "psql completed with exit code $restoreExitCode. Full dashboard backups commonly report existing managed-schema objects; inspect the log and verified counts before proceeding."
  }

  Write-Host 'Database restore step finished. Do not switch the app yet; Storage bytes, Auth settings, functions, secrets, and Realtime still need migration.'
}
finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }

  $plainPassword = $null
  $securePassword = $null

  if ($null -eq $previousPgPassword) {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
  else {
    $env:PGPASSWORD = $previousPgPassword
  }
}
