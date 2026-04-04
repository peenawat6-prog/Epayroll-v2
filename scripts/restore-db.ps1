param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$databaseUrl = $env:DATABASE_URL

if (-not $databaseUrl) {
  Write-Error "DATABASE_URL is required"
  exit 1
}

if (-not (Test-Path $BackupFile)) {
  Write-Error "Backup file not found: $BackupFile"
  exit 1
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error "psql was not found in PATH"
  exit 1
}

psql $databaseUrl -f $BackupFile

if ($LASTEXITCODE -ne 0) {
  Write-Error "Restore failed"
  exit $LASTEXITCODE
}

Write-Output "Restore completed from $BackupFile"
