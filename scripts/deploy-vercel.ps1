param(
  [switch]$Prod = $true
)

$required = @(
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID"
)

$missing = $required | Where-Object {
  -not [System.Environment]::GetEnvironmentVariable($_)
}

if ($missing.Count -gt 0) {
  Write-Error ("Missing required environment variables: " + ($missing -join ", "))
  exit 1
}

$args = @("vercel", "deploy", "--yes", "--token=$($env:VERCEL_TOKEN)")

if ($Prod) {
  $args += "--prod"
}

npx @args

if ($LASTEXITCODE -ne 0) {
  Write-Error "Vercel deploy failed"
  exit $LASTEXITCODE
}

Write-Output "Vercel deploy completed"
