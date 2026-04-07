param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [string]$OwnerEmail = "owner@demo.local",
  [string]$OwnerPassword = "@Epayroll2026",
  [string]$EmployeeEmail = "employee@demo.local",
  [string]$EmployeePassword = "@Epayroll2026"
)

$env:SMOKE_BASE_URL = $BaseUrl
$env:SMOKE_OWNER_EMAIL = $OwnerEmail
$env:SMOKE_OWNER_PASSWORD = $OwnerPassword
$env:SMOKE_EMPLOYEE_EMAIL = $EmployeeEmail
$env:SMOKE_EMPLOYEE_PASSWORD = $EmployeePassword

node scripts/smoke-test.mjs

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Output "Smoke test completed for $BaseUrl"
