[CmdletBinding()]
param(
  [string]$BackupPath = 'C:\Users\elink\Downloads\heart-lens-studio_261119.backup',
  [string]$PoolerHost = 'aws-0-eu-west-1.pooler.supabase.com',
  [int]$Port = 5432,
  [string]$DatabaseName = 'postgres',
  [string]$DatabaseUser = 'postgres.fkeyentcklsuqecqgmak',
  [string]$PgBin = 'C:\Users\elink\AppData\Local\Temp\serkle-pg17-client\pgsql\bin'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$pgRestore = Join-Path $PgBin 'pg_restore.exe'
$psql = Join-Path $PgBin 'psql.exe'

foreach ($path in @($BackupPath, $pgRestore, $psql)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required file not found: $path"
  }
}

if ($DatabaseUser -ne 'postgres.fkeyentcklsuqecqgmak') {
  throw 'Refusing to target an unexpected database user.'
}

$connectionArgs = @(
  "--host=$PoolerHost"
  "--port=$Port"
  "--username=$DatabaseUser"
  "--dbname=$DatabaseName"
  '--no-password'
  '--pset=pager=off'
)

$expectedCounts = [ordered]@{
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
  'objects.public_tables' = 131L
  'objects.public_functions' = 192L
  'objects.public_policies' = 390L
  'objects.public_triggers' = 77L
  'objects.public_foreign_keys' = 209L
  'objects.public_indexes' = 124L
  'realtime.publication_tables' = 10L
}

$verificationSql = @'
select 'auth.users' as metric, count(*)::bigint as value from auth.users
union all select 'auth.identities', count(*)::bigint from auth.identities
union all select 'storage.buckets', count(*)::bigint from storage.buckets
union all select 'storage.objects', count(*)::bigint from storage.objects
union all select 'public.profiles', count(*)::bigint from public.profiles
union all select 'public.posts', count(*)::bigint from public.posts
union all select 'public.messages', count(*)::bigint from public.messages
union all select 'public.circles', count(*)::bigint from public.circles
union all select 'public.coin_transactions', count(*)::bigint from public.coin_transactions
union all select 'supabase_migrations.schema_migrations', count(*)::bigint from supabase_migrations.schema_migrations
union all select 'objects.public_tables', count(*)::bigint
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
union all select 'objects.public_functions', count(*)::bigint
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (
      select 1 from pg_depend d
      where d.classid = 'pg_proc'::regclass
        and d.objid = p.oid
        and d.deptype = 'e'
    )
union all select 'objects.public_policies', count(*)::bigint
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
union all select 'objects.public_triggers', count(*)::bigint
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
union all select 'objects.public_foreign_keys', count(*)::bigint
  from pg_constraint c join pg_namespace n on n.oid = c.connamespace
  where n.nspname = 'public' and c.contype = 'f'
union all select 'objects.public_indexes', count(*)::bigint
  from pg_index i
  join pg_class idx on idx.oid = i.indexrelid
  join pg_class tbl on tbl.oid = i.indrelid
  join pg_namespace n on n.oid = tbl.relnamespace
  left join pg_constraint con on con.conindid = idx.oid
  where n.nspname = 'public' and con.oid is null
union all select 'realtime.publication_tables', count(*)::bigint
  from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public'
order by metric;
'@

function Get-DatabaseCounts {
  $lines = & $psql @connectionArgs --set ON_ERROR_STOP=1 --tuples-only --no-align --command $verificationSql
  if ($LASTEXITCODE -ne 0) {
    throw 'Database verification query failed.'
  }

  $counts = @{}
  foreach ($line in $lines) {
    if ($line -match '^([^|]+)\|(\d+)$') {
      $counts[$matches[1]] = [long]$matches[2]
    }
  }
  return $counts
}

function Get-CountMismatches([hashtable]$Counts) {
  $mismatches = @()
  foreach ($metric in $expectedCounts.Keys) {
    if (-not $Counts.ContainsKey($metric)) {
      $mismatches += "$metric was not returned"
    }
    elseif ($Counts[$metric] -ne $expectedCounts[$metric]) {
      $mismatches += "$metric expected $($expectedCounts[$metric]), found $($Counts[$metric])"
    }
  }
  return $mismatches
}

$securePassword = Read-Host 'Enter the NEW Supabase database password' -AsSecureString
$passwordPointer = [IntPtr]::Zero
$plainPassword = $null
$previousPgPassword = $env:PGPASSWORD

try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:PGPASSWORD = $plainPassword

  Write-Host 'Checking the partially restored database...'
  $beforeCounts = Get-DatabaseCounts

  $dataMetrics = @(
    'auth.users',
    'auth.identities',
    'storage.buckets',
    'storage.objects',
    'public.profiles',
    'public.posts',
    'public.messages',
    'public.circles',
    'public.coin_transactions',
    'supabase_migrations.schema_migrations',
    'objects.public_tables',
    'objects.public_functions'
  )
  foreach ($metric in $dataMetrics) {
    if (-not $beforeCounts.ContainsKey($metric) -or $beforeCounts[$metric] -ne $expectedCounts[$metric]) {
      throw "Refusing post-data resume because $metric does not match the frozen backup."
    }
  }

  $workingRoot = Join-Path $env:TEMP 'serkle-supabase-migration'
  $logRoot = Join-Path $workingRoot 'logs'
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $postDataSql = Join-Path $workingRoot 'heart-lens-studio_261119.post-data.sql'
  $logPath = Join-Path $logRoot "post-data-resume-$timestamp.log"

  Write-Host 'Extracting post-data objects only (no table rows)...'
  & $pgRestore --section=post-data --no-owner --file=$postDataSql $BackupPath
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not extract the post-data section from the backup.'
  }

  Write-Host 'Retrying constraints, indexes, triggers, policies, grants, and publications...'
  Write-Host "Resume log: $logPath"
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $psql @connectionArgs --file $postDataSql 2>&1 | Tee-Object -FilePath $logPath
    $resumeExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  Write-Host 'Verifying final data and schema counts...'
  $afterCounts = Get-DatabaseCounts
  foreach ($metric in $expectedCounts.Keys) {
    $actual = if ($afterCounts.ContainsKey($metric)) { $afterCounts[$metric] } else { 'missing' }
    Write-Host ("{0,-42} {1,8} / {2}" -f $metric, $actual, $expectedCounts[$metric])
  }

  $mismatches = @(Get-CountMismatches $afterCounts)
  if ($mismatches.Count -gt 0) {
    throw "Post-data verification failed: $($mismatches -join '; '). Inspect $logPath."
  }

  if ($resumeExitCode -ne 0) {
    Write-Warning "psql returned exit code $resumeExitCode because existing post-data objects were retried. All required counts nevertheless match the backup."
  }

  Write-Host ''
  Write-Host 'POST-DATA RESTORE VERIFIED SUCCESSFULLY.' -ForegroundColor Green
  Write-Host 'Database data and required public schema objects match the frozen backup.'
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
