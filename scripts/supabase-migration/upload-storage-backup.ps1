[CmdletBinding()]
param(
  [string]$SourceRoot = 'C:\sb',
  [string]$VerifyRoot = 'C:\sv',
  [string]$ProjectRef = 'fkeyentcklsuqecqgmak',
  [string]$Region = 'eu-west-1',
  [string]$AwsPath = 'C:\Program Files\Amazon\AWSCLIV2\aws.exe'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$expectedBuckets = @(
  'avatars',
  'chat-media',
  'circle-avatars',
  'circle-covers',
  'circle-resources',
  'circle-videos',
  'group-avatars',
  'post-media',
  'shop-item-images',
  'sos-photos',
  'story-media',
  'video-media'
)
$expectedFileCount = 1116
$maximumUploadBytes = 50MB
$endpoint = "https://$ProjectRef.storage.supabase.co/storage/v1/s3"
$checkpointPath = Join-Path $SourceRoot '.serkle-verified-buckets.txt'
$verifyMarkerPath = Join-Path $VerifyRoot '.serkle-storage-verification'
$logRoot = Join-Path $PSScriptRoot 'logs'
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $logRoot "storage-upload-$runStamp.log"
$awsConfigPath = Join-Path $PSScriptRoot 'aws-storage-migration.config'
$deferredPath = Join-Path $logRoot 'storage-deferred-over-50MiB.txt'

function Write-RunLog([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Write-Host $line
  Add-Content -LiteralPath $logPath -Value $line
}

function Invoke-Aws([string[]]$Arguments) {
  $previousErrorPreference = $ErrorActionPreference
  $awsOutput = @()
  try {
    $ErrorActionPreference = 'Continue'
    $awsOutput = @(& $AwsPath @Arguments 2>&1)
    $awsExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorPreference
  }
  foreach ($outputLine in $awsOutput) {
    $message = [string]$outputLine
    Write-Host $message
    Add-Content -LiteralPath $logPath -Value "[AWS] $message"
  }
  if ($awsExitCode -ne 0) {
    throw "AWS CLI failed with exit code $awsExitCode"
  }
}

function Invoke-AwsQuiet([string[]]$Arguments) {
  $previousErrorPreference = $ErrorActionPreference
  $awsOutput = @()
  try {
    $ErrorActionPreference = 'Continue'
    $awsOutput = @(& $AwsPath @Arguments 2>&1)
    $awsExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorPreference
  }
  if ($awsExitCode -ne 0) {
    foreach ($outputLine in $awsOutput) {
      $message = [string]$outputLine
      Write-Host $message
      Add-Content -LiteralPath $logPath -Value "[AWS] $message"
    }
    throw "AWS CLI failed with exit code $awsExitCode"
  }
}

function Get-NormalizedRelativePath([string]$Root, [string]$Path) {
  $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\')
  $resolvedPath = [IO.Path]::GetFullPath($Path)
  $rootPrefix = "$resolvedRoot\"
  if (-not $resolvedPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path is outside the expected root ${resolvedRoot}: $resolvedPath"
  }
  return $resolvedPath.Substring($rootPrefix.Length).Replace('\', '/')
}

function Get-Sha256([string]$Path) {
  $stream = $null
  $algorithm = $null
  try {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    $hashBytes = $algorithm.ComputeHash($stream)
    return ([BitConverter]::ToString($hashBytes)).Replace('-', '')
  }
  finally {
    if ($null -ne $algorithm) { $algorithm.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
  }
}

function Assert-RemoteBucket([string]$Bucket, [string]$SourcePath, [long]$MaximumBytes) {
  $sourceObjects = @(Get-ChildItem -LiteralPath $SourcePath -Recurse -File -Force |
    Where-Object { $_.Length -le $MaximumBytes })
  $temporaryObjectPath = Join-Path $VerifyRoot '.object'
  $checked = 0
  foreach ($sourceFile in $sourceObjects) {
    $key = Get-NormalizedRelativePath $SourcePath $sourceFile.FullName
    try {
      if (Test-Path -LiteralPath $temporaryObjectPath) {
        Remove-Item -LiteralPath $temporaryObjectPath -Force
      }
      Invoke-AwsQuiet @(
        's3api', 'get-object',
        '--bucket', $Bucket,
        '--key', $key,
        '--endpoint-url', $endpoint,
        '--region', $Region,
        '--no-cli-pager',
        $temporaryObjectPath
      )

      $downloadedFile = Get-Item -LiteralPath $temporaryObjectPath
      if ($sourceFile.Length -ne $downloadedFile.Length) {
        throw "Verification failed for ${Bucket}: size differs for $key"
      }

      $sourceHash = Get-Sha256 $sourceFile.FullName
      $downloadedHash = Get-Sha256 $downloadedFile.FullName
      if ($sourceHash -ne $downloadedHash) {
        throw "Verification failed for ${Bucket}: SHA-256 differs for $key"
      }
      $checked++
      if (($checked % 25) -eq 0 -or $checked -eq $sourceObjects.Count) {
        Write-RunLog "Verified $checked/$($sourceObjects.Count) objects from $Bucket."
      }
    }
    finally {
      if (Test-Path -LiteralPath $temporaryObjectPath) {
        Remove-Item -LiteralPath $temporaryObjectPath -Force
      }
    }
  }
}

function Remove-VerifiedDownload([string]$Path) {
  $resolvedVerifyRoot = [IO.Path]::GetFullPath($VerifyRoot).TrimEnd('\')
  $resolvedTarget = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  if (-not $resolvedTarget.StartsWith("$resolvedVerifyRoot\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove verification path outside ${resolvedVerifyRoot}: $resolvedTarget"
  }
  if (Test-Path -LiteralPath $resolvedTarget) {
    Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
  }
}

if (-not (Test-Path -LiteralPath $AwsPath -PathType Leaf)) {
  throw "AWS CLI was not found at $AwsPath"
}
if (-not (Test-Path -LiteralPath $SourceRoot -PathType Container)) {
  throw "The extracted Storage directory was not found: $SourceRoot"
}

$sourceBuckets = @(Get-ChildItem -LiteralPath $SourceRoot -Directory -Force | Sort-Object Name)
$unexpectedBuckets = @($sourceBuckets.Name | Where-Object { $_ -notin $expectedBuckets })
$missingBuckets = @($expectedBuckets | Where-Object { $_ -notin $sourceBuckets.Name })
$sourceFiles = @(Get-ChildItem -LiteralPath $SourceRoot -Recurse -File -Force |
  Where-Object { $_.FullName -ne $checkpointPath })

if ($unexpectedBuckets.Count -gt 0 -or $missingBuckets.Count -gt 0) {
  throw "Bucket folders do not match the verified archive. Missing: $($missingBuckets -join ', '); unexpected: $($unexpectedBuckets -join ', ')"
}
if ($sourceFiles.Count -ne $expectedFileCount) {
  throw "Expected $expectedFileCount extracted objects, found $($sourceFiles.Count)."
}

if (Test-Path -LiteralPath $VerifyRoot) {
  if (-not (Test-Path -LiteralPath $verifyMarkerPath -PathType Leaf)) {
    throw "Refusing to use existing verification directory without the Serkle marker: $VerifyRoot"
  }
} else {
  New-Item -ItemType Directory -Path $VerifyRoot | Out-Null
  New-Item -ItemType File -Path $verifyMarkerPath | Out-Null
}

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$deferredFiles = @($sourceFiles | Where-Object { $_.Length -gt $maximumUploadBytes } | Sort-Object FullName)
$eligibleFileCount = $sourceFiles.Count - $deferredFiles.Count
$deferredManifest = @(
  '# Serkle Storage objects deferred until the Supabase project supports files over 50 MiB'
  "# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
  "# Count: $($deferredFiles.Count)"
  '# Format: bucket/object-key<TAB>bytes<TAB>MiB'
)
foreach ($file in $deferredFiles) {
  $relativePath = Get-NormalizedRelativePath $SourceRoot $file.FullName
  $deferredManifest += "$relativePath`t$($file.Length)`t$([math]::Round($file.Length / 1MB, 2))"
}
Set-Content -LiteralPath $deferredPath -Value $deferredManifest -Encoding UTF8
Write-RunLog "Verified $($sourceFiles.Count) extracted objects in $($sourceBuckets.Count) buckets."
Write-RunLog "Deferring $($deferredFiles.Count) objects over 50 MiB; $eligibleFileCount objects remain eligible for this run."
Write-Host ''
Write-Host 'Enter the temporary S3 credentials generated in Supabase Storage settings.' -ForegroundColor Cyan
Write-Host 'They remain only in this process and are cleared when the window closes.' -ForegroundColor Cyan
$accessKey = (Read-Host 'S3 Access Key ID').Trim()
$secureSecret = Read-Host 'S3 Secret Access Key' -AsSecureString
if (-not $accessKey -or $secureSecret.Length -eq 0) {
  throw 'Both S3 credentials are required.'
}

$secretPointer = [IntPtr]::Zero
$secretKey = $null
try {
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
  $secretKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)

  $env:AWS_ACCESS_KEY_ID = $accessKey
  $env:AWS_SECRET_ACCESS_KEY = $secretKey
  $env:AWS_DEFAULT_REGION = $Region
  $env:AWS_REGION = $Region
  $env:AWS_REQUEST_CHECKSUM_CALCULATION = 'WHEN_REQUIRED'
  $env:AWS_RESPONSE_CHECKSUM_VALIDATION = 'WHEN_REQUIRED'
  $env:AWS_EC2_METADATA_DISABLED = 'true'
  $env:AWS_CONFIG_FILE = $awsConfigPath
  $env:AWS_RETRY_MODE = 'adaptive'
  $env:AWS_MAX_ATTEMPTS = '10'

  Write-RunLog "Testing the temporary S3 connection to $ProjectRef in $Region."
  Invoke-Aws @(
    's3', 'ls',
    '--endpoint-url', $endpoint,
    '--region', $Region,
    '--no-cli-pager'
  )

  $verified = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  if (Test-Path -LiteralPath $checkpointPath) {
    foreach ($bucket in Get-Content -LiteralPath $checkpointPath) {
      if ($bucket -in $expectedBuckets) { [void]$verified.Add($bucket) }
    }
  }

  foreach ($bucket in $expectedBuckets) {
    if ($verified.Contains($bucket)) {
      Write-RunLog "Skipping already download-verified bucket: $bucket"
      continue
    }

    $localPath = Join-Path $SourceRoot $bucket
    $verifyBucketPath = Join-Path $VerifyRoot $bucket
    Remove-VerifiedDownload $verifyBucketPath
    $bucketFiles = @(Get-ChildItem -LiteralPath $localPath -Recurse -File -Force)
    $deferredBucketFiles = @($bucketFiles | Where-Object { $_.Length -gt $maximumUploadBytes })
    $eligibleBucketCount = $bucketFiles.Count - $deferredBucketFiles.Count

    Write-RunLog "Uploading $bucket ($eligibleBucketCount eligible objects; $($deferredBucketFiles.Count) deferred). Remote objects are never deleted."
    $uploadArguments = @(
      's3', 'cp', $localPath, "s3://$bucket/",
      '--recursive',
      '--endpoint-url', $endpoint,
      '--region', $Region,
      '--only-show-errors',
      '--no-cli-pager'
    )
    foreach ($file in $deferredBucketFiles) {
      $deferredKey = Get-NormalizedRelativePath $localPath $file.FullName
      $uploadArguments += @('--exclude', $deferredKey)
      Write-RunLog "Deferred oversized object: $bucket/$deferredKey ($([math]::Round($file.Length / 1MB, 2)) MiB)"
    }
    Invoke-Aws $uploadArguments

    Write-RunLog "Downloading and SHA-256 checking each $bucket object through a short verification path."
    Assert-RemoteBucket $bucket $localPath $maximumUploadBytes
    Add-Content -LiteralPath $checkpointPath -Value $bucket
    [void]$verified.Add($bucket)
    Remove-VerifiedDownload $verifyBucketPath
    Write-RunLog "Verified bucket: $bucket"
  }

  if ($verified.Count -ne $expectedBuckets.Count) {
    throw "Only $($verified.Count) of $($expectedBuckets.Count) buckets were verified."
  }

  if (@(Get-ChildItem -LiteralPath $VerifyRoot -Force).Count -eq 1 -and
      (Test-Path -LiteralPath $verifyMarkerPath -PathType Leaf)) {
    Remove-Item -LiteralPath $verifyMarkerPath -Force
    Remove-Item -LiteralPath $VerifyRoot -Force
  }

  Write-RunLog "SUCCESS: uploaded and download-verified all $eligibleFileCount eligible Storage objects; $($deferredFiles.Count) oversized objects remain deferred."
  Write-Host ''
  Write-Host 'Eligible Storage migration completed successfully.' -ForegroundColor Green
  Write-Host "Deferred oversized-object manifest: $deferredPath" -ForegroundColor Yellow
  Write-Host 'Return to Codex, then revoke the temporary S3 access key in Supabase.' -ForegroundColor Yellow
}
finally {
  Remove-Item Env:AWS_ACCESS_KEY_ID -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_DEFAULT_REGION -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_REGION -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_EC2_METADATA_DISABLED -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_REQUEST_CHECKSUM_CALCULATION -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_RESPONSE_CHECKSUM_VALIDATION -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_CONFIG_FILE -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_RETRY_MODE -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_MAX_ATTEMPTS -ErrorAction SilentlyContinue
  $accessKey = $null
  $secretKey = $null
  $secureSecret = $null
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  Write-Host ''
  Write-Host "Non-secret migration log: $logPath"
}
