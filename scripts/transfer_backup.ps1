# Moves a backup made by backup_server.ps1 to a new Ubuntu 22.04+ server and restores it there.
# The new server must accept the SSH key in -KeyFile. Restore extracts the archive and runs ubuntu-server/install.sh from /opt/sr.
param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [Parameter(Mandatory = $true)][string]$NewServer,
  [string]$KeyFile = (Join-Path $env:USERPROFILE '.ssh\sr_deploy'),
  [int]$Port = 22,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$RemoteDir = '/var/backups/sr/incoming'
$SshOpts = @('-i', $KeyFile, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')
$SshPortOpt = @('-p', "$Port")
$ScpPortOpt = @('-P', "$Port")

function Fail([string]$Message) { throw $Message }

if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { Fail "backup not found: $BackupFile" }
if (-not (Test-Path -LiteralPath $KeyFile -PathType Leaf)) { Fail "SSH key not found: $KeyFile" }

$FileName = Split-Path -Leaf $BackupFile
$LocalHash = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
$ShaFile = "$BackupFile.sha256"
if (Test-Path -LiteralPath $ShaFile -PathType Leaf) {
  $Expected = ((Get-Content -LiteralPath $ShaFile -TotalCount 1) -split '\s+')[0].ToLowerInvariant()
  if ($Expected -ne $LocalHash) { Fail "local checksum does not match $ShaFile" }
  Write-Host 'local SHA-256 matches the .sha256 file'
}

Write-Host "checking connection to $NewServer"
& ssh @SshOpts @SshPortOpt $NewServer 'true'
if ($LASTEXITCODE -ne 0) { Fail "cannot connect to $NewServer with the key in $KeyFile" }

$Remote = "$RemoteDir/$FileName"
& ssh @SshOpts @SshPortOpt $NewServer "install -d -m 700 $RemoteDir"
if ($LASTEXITCODE -ne 0) { Fail 'cannot create incoming folder on the new server' }

Write-Host 'uploading backup'
& scp @SshOpts @ScpPortOpt $BackupFile "${NewServer}:$Remote"
if ($LASTEXITCODE -ne 0) { Fail 'upload failed' }

$RestoreScript = @'
set -euo pipefail
ARCH='__ARCH__'
FORCE=__FORCE__
REMOTE_HASH=$(sha256sum "$ARCH" | awk '{print $1}')
[ "$REMOTE_HASH" = '__HASH__' ] || { echo "checksum mismatch on the new server" >&2; exit 1; }
echo "server-side SHA-256 matched"
if [ -e /opt/sr/data/sr.duckdb ] && [ "$FORCE" != 1 ]; then
  echo "new server already has a database at /opt/sr/data/sr.duckdb; rerun with -Force to overwrite" >&2
  exit 1
fi
tar -xzf "$ARCH" -C /
bash /opt/sr/install.sh
'@

$RestoreScript = $RestoreScript.Replace('__ARCH__', $Remote).Replace('__HASH__', $LocalHash).Replace('__FORCE__', $(if ($Force) { '1' } else { '0' })) -replace '\r', ''

Write-Host 'restoring on the new server (extract, then install.sh)'
$Encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($RestoreScript))
& ssh @SshOpts @SshPortOpt -o ServerAliveInterval=15 $NewServer "echo $Encoded | base64 -d | bash"
if ($LASTEXITCODE -ne 0) { Fail 'restore failed; the uploaded archive is kept on the new server' }

Write-Host "done: restored to $NewServer. Check: curl -I http://<server-ip>:8000/api/meta should return 401 (login required)"
exit 0
