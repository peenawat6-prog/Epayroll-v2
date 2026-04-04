param(
  [string]$OutputDir = ".\\backups"
)

$databaseUrl = $env:DATABASE_URL

if (-not $databaseUrl) {
  Write-Error "DATABASE_URL is required"
  exit 1
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  Write-Error "pg_dump was not found in PATH"
  exit 1
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $OutputDir "backup_$timestamp.sql"

pg_dump --dbname=$databaseUrl --format=plain --no-owner --no-privileges --file=$outputFile

if ($LASTEXITCODE -ne 0) {
  Write-Error "Backup failed"
  exit $LASTEXITCODE
}

Write-Output "Backup created at $outputFile"
