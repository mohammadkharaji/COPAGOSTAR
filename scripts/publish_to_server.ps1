# Publish sales (DAX) and optional returns: verify SHA-256 on the server, activate, start and wait for sr-sync.
# -Scope all: every sales query (full recovery). -Scope recent: current and previous Jalali month, plus product and salesunit.
param(
  [string]$Server = 'root@194.5.205.59',
  [string]$KeyFile = (Join-Path $env:USERPROFILE '.ssh\sr_deploy'),
  [string]$RemoteData = '/opt/sr/data',
  [string]$SalesWorkbook = (Join-Path (Split-Path -Parent $PSScriptRoot) 'SR-1405.xlsx'),
  [string]$ReturnsWorkbook,
  [ValidateSet('all', 'recent')][string]$Scope = 'all',
  [int]$WaitMinutes = 15,
  [switch]$CheckOnly,
  [switch]$ReturnsOnly
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Queries = Join-Path $Root 'data\queries'
$Python = Join-Path $Root 'backend\.venv\Scripts\python.exe'
$Converter = Join-Path $Root 'tools\returns\convert_returns.py'
$State = Join-Path $Root 'data\returns_state_kg.json'
$Export = Join-Path $Root ('data\export_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$SshOpts = @('-i', $KeyFile, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')

function Fail([string]$Message) { throw $Message }
function Remote([string]$Command) {
  $out = & ssh -n @SshOpts -o ServerAliveInterval=15 -o ServerAliveCountMax=2 $Server $Command
  if ($LASTEXITCODE -ne 0) { Fail "remote command failed: $Command" }
  return $out
}

try {
  if ($ReturnsOnly -and -not $ReturnsWorkbook) { Fail 'returns workbook required for returns-only mode' }
  if (-not $ReturnsOnly -and -not (Test-Path -LiteralPath $SalesWorkbook -PathType Leaf)) { Fail "sales workbook not found: $SalesWorkbook" }
  if ($ReturnsWorkbook -and -not (Test-Path -LiteralPath $ReturnsWorkbook -PathType Leaf)) { Fail "returns workbook not found: $ReturnsWorkbook" }
  if (-not $CheckOnly -and -not (Test-Path -LiteralPath $KeyFile -PathType Leaf)) { Fail "SSH key not found: $KeyFile" }
  if ($ReturnsWorkbook -and (-not (Test-Path -LiteralPath $Python -PathType Leaf) -or -not (Test-Path -LiteralPath $Converter -PathType Leaf))) { Fail 'returns converter or Python not found' }

  $selected = @()
  $months = 'none'
  if (-not $ReturnsOnly) {
    $allQueries = @(Get-ChildItem -LiteralPath $Queries -Filter '*.dax')
    if ($allQueries.Count -eq 0) { Fail "no DAX queries in $Queries" }
    if ($Scope -eq 'recent') {
      $cal = New-Object System.Globalization.PersianCalendar
      $now = Get-Date
      $y = $cal.GetYear($now)
      $m = $cal.GetMonth($now)
      $py = $y
      $pm = $m - 1
      if ($pm -eq 0) { $pm = 12; $py = $y - 1 }
      $keep = @(('{0:0000}{1:00}' -f $y, $m), ('{0:0000}{1:00}' -f $py, $pm))
      $selected = @($allQueries | Where-Object {
        if ($_.BaseName -in @('product', 'salesunit')) { return $true }
        if ($_.BaseName -match '^sr_(kg|ch)_(\d{6})$') { return ($keep -contains $Matches[2]) }
        return $false
      })
      if (@($selected | Where-Object { $_.BaseName -match '^sr_(kg|ch)_\d{6}$' }).Count -eq 0) { Fail 'no sales month queries selected for recent scope' }
      $missing = @()
      foreach ($ym in $keep) {
        foreach ($core in 'kg', 'ch') {
          if (@($selected | Where-Object { $_.BaseName -eq "sr_${core}_$ym" }).Count -eq 0) { $missing += "sr_${core}_$ym" }
        }
      }
      if ($missing.Count -gt 0) { Fail "missing sales month queries for recent scope: $($missing -join ', ')" }
      $months = $keep -join ', '
    } else {
      $selected = $allQueries
      $months = 'all'
    }
    if ($selected.Count -eq 0) { Fail 'no queries selected for this scope' }
  }

  Write-Host "pre-check ok: scope=$Scope months=$months queries=$($selected.Count)"

  if ($ReturnsWorkbook) {
    & $Python -X utf8 $Converter $ReturnsWorkbook --check
    if ($LASTEXITCODE -ne 0) { Fail 'returns check failed' }
    & $Python -X utf8 $Converter $ReturnsWorkbook --dry-run
    if ($LASTEXITCODE -ne 0) { Fail 'returns dry run failed' }
  }
  if ($CheckOnly) { Write-Host 'check only: nothing exported or uploaded'; exit 0 }

  New-Item -ItemType Directory -Force -Path $Export | Out-Null
  $OutDir = Join-Path $Export 'tsv'
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $sales = @()
  if (-not $ReturnsOnly) {
    $QueryDir = Join-Path $Export 'queries'
    New-Item -ItemType Directory -Force -Path $QueryDir | Out-Null
    $selected | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $QueryDir }
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run_dax.ps1') -QueryDir $QueryDir -OutDir $OutDir -Workbook $SalesWorkbook
    if ($LASTEXITCODE -ne 0) { Fail 'sales DAX export failed' }
    $sales = @(Get-ChildItem -LiteralPath $OutDir -Filter '*.tsv' -File)
    if ($sales.Count -ne $selected.Count) { Fail "sales export incomplete: $($sales.Count) of $($selected.Count)" }
  }

  $pending = Join-Path $Export 'returns.pending.json'
  $returns = @()
  if ($ReturnsWorkbook) {
    & $Python -X utf8 $Converter $ReturnsWorkbook --out $OutDir --state $State --pending-state $pending
    if ($LASTEXITCODE -ne 0) { Fail 'returns conversion failed' }
    $returns = @(Get-ChildItem -LiteralPath $OutDir -Filter 'ret_*.tsv' -File)
  }
  $files = @($sales) + @($returns)
  if ($files.Count -eq 0) { Write-Host 'no new returns; nothing uploaded or committed'; exit 0 }
  if ($returns.Count -gt 0 -and -not (Test-Path -LiteralPath $pending -PathType Leaf)) { Fail 'returns pending state missing' }
  $syncFiles = @($files | Where-Object { $_.Name -ne 'salesunit.tsv' })

  $stage = "$RemoteData/raw_incoming/publish_$([guid]::NewGuid().ToString('N'))"
  $start = (Remote 'date +%Y-%m-%dT%H:%M:%S' | Select-Object -First 1).Trim()
  Remote "mkdir -p $stage" | Out-Null
  foreach ($f in $files) {
    & scp @SshOpts $f.FullName "${Server}:$stage/$($f.Name)"
    if ($LASTEXITCODE -ne 0) { Fail "upload failed: $($f.Name); staging kept at $stage" }
  }

  $local = @($files | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() + ' ' + $_.Name } | Sort-Object)
  $remote = @(Remote "cd $stage && sha256sum *.tsv" | ForEach-Object { ($_ -split '\s+')[0].ToLowerInvariant() + ' ' + ($_ -split '\s+')[1] } | Sort-Object)
  if (@(Compare-Object $local $remote).Count -ne 0) { Fail "checksum mismatch; nothing activated; staging kept at $stage" }
  Write-Host 'SHA-256 matched for every file'

  Remote "chown sr:sr $stage/*.tsv && for f in $stage/*.tsv; do mv -f `"`$f`" $RemoteData/raw/; done && rmdir $stage" | Out-Null
  Remote "systemctl is-active --quiet sr-sync || systemctl start sr-sync" | Out-Null
  Write-Host 'activated; waiting for sr-sync'
  $deadline = (Get-Date).AddMinutes($WaitMinutes)
  do {
    Start-Sleep -Seconds 20
    $status = (Remote "cat $RemoteData/sync_status.json") -join "`n" | ConvertFrom-Json
    $seen = @($status.signature | ForEach-Object { $_[0] })
    $done = ($status.state -in @('ok', 'failed')) -and ([string]$status.started_at -ge $start) -and (@($syncFiles | Where-Object { $seen -notcontains $_.Name }).Count -eq 0)
  } until ($done -or (Get-Date) -ge $deadline)
  if (-not $done) { Fail 'sync did not confirm all tracked files before the timeout' }
  if ($status.state -ne 'ok') { Fail "server sync failed: $($status.error)" }

  if ($returns.Count -gt 0) {
    & $Python -X utf8 $Converter --state $State --pending-state $pending --commit-state
    if ($LASTEXITCODE -ne 0) { Fail "sync ok but returns state not committed: $pending" }
  }
  Write-Host "done: $($files.Count) files uploaded and SHA-256 verified; $($syncFiles.Count) sync-tracked files confirmed"
  exit 0
} catch {
  Write-Error "FAILED: $($_.Exception.Message)"
  exit 1
}
