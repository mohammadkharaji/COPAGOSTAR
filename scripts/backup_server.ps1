# Full backup of the production SR server: app, DuckDB data, raw extracts, config and secrets, downloaded and checksum-verified.
# Briefly stops sr-api and sr-sync so the database is copied in a consistent state, then starts them again.
param(
  [string]$Server = 'root@194.5.205.59',
  [string]$KeyFile = (Join-Path $env:USERPROFILE '.ssh\sr_deploy'),
  [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'backups'),
  [switch]$KeepServicesRunning
)

$ErrorActionPreference = 'Stop'
$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Name = "sr-backup-$Stamp"
$RemoteDir = '/var/backups/sr'
$SshOpts = @('-i', $KeyFile, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')

function Fail([string]$Message) { throw $Message }

if (-not (Test-Path -LiteralPath $KeyFile -PathType Leaf)) { Fail "SSH key not found: $KeyFile" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$RemoteScript = @'
set -euo pipefail
NAME='__NAME__'
DIR='__DIR__'
STOP_SERVICES=__STOP__
ARCHIVE="$DIR/$NAME.tar.gz"
install -d -m 700 "$DIR"
if [ "$STOP_SERVICES" = 1 ]; then
  trap 'systemctl start sr-sync sr-api' EXIT
  systemctl stop sr-api sr-sync
fi
tar -czf "$ARCHIVE" -C / \
  --exclude='opt/sr/backend/.venv' \
  --exclude='opt/sr/frontend/node_modules' \
  --exclude='opt/sr/frontend/dist' \
  --exclude='*/__pycache__' \
  --exclude='opt/sr/backend/.pytest_cache' \
  opt/sr etc/sr etc/systemd/system/sr-api.service etc/systemd/system/sr-sync.service
chmod 600 "$ARCHIVE"
sha256sum "$ARCHIVE" | awk '{print $1}'
ls -l "$ARCHIVE"
'@

$RemoteScript = $RemoteScript.Replace('__NAME__', $Name).Replace('__DIR__', $RemoteDir).Replace('__STOP__', $(if ($KeepServicesRunning) { '0' } else { '1' })) -replace '\r', ''

Write-Host "creating archive on server: $Name.tar.gz"
$Encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($RemoteScript))
$RemoteOut = & ssh @SshOpts -o ServerAliveInterval=15 $Server "echo $Encoded | base64 -d | bash"
if ($LASTEXITCODE -ne 0) { Fail 'remote archive step failed; check that sr-api and sr-sync are running on the server' }
$RemoteHash = (@($RemoteOut) | Select-Object -First 1).Trim()
if ($RemoteHash -notmatch '^[0-9a-f]{64}$') { Fail "unexpected checksum output from server: $RemoteHash" }

$LocalArchive = Join-Path $OutDir "$Name.tar.gz"
Write-Host 'downloading archive'
& scp @SshOpts "${Server}:$RemoteDir/$Name.tar.gz" $LocalArchive
if ($LASTEXITCODE -ne 0) { Fail "download failed; archive kept on server at $RemoteDir/$Name.tar.gz" }

$LocalHash = (Get-FileHash -LiteralPath $LocalArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($LocalHash -ne $RemoteHash) { Fail "checksum mismatch after download; server copy kept at $RemoteDir/$Name.tar.gz" }
Set-Content -LiteralPath "$LocalArchive.sha256" -Value "$LocalHash  $Name.tar.gz" -Encoding ascii

$SizeMB = [math]::Round((Get-Item -LiteralPath $LocalArchive).Length / 1MB, 1)
Write-Host "done: $LocalArchive ($SizeMB MB), SHA-256 verified"
Write-Host "server copy kept at $RemoteDir/$Name.tar.gz"
exit 0
