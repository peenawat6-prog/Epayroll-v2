param(
  [string]$ExportFile = ".\docs\FULL_FILE_EXPORT.md",
  [switch]$Refresh,
  [int]$PreviewLines = 40
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$normalizedExportFile = $ExportFile -replace '^[.\\\/]+', ''
$exportPath = Join-Path $root $normalizedExportFile
$exportScript = Join-Path $PSScriptRoot "export-full-files.ps1"

if ($Refresh -or !(Test-Path $exportPath)) {
  & $exportScript -OutputFile $ExportFile | Out-Null
}

if (!(Test-Path $exportPath)) {
  throw "ไม่พบไฟล์ export ที่ $exportPath"
}

$fileItem = Get-Item -LiteralPath $exportPath
$generatedLine = Get-Content -LiteralPath $exportPath -TotalCount 10 |
  Where-Object { $_ -like "Generated at:*" } |
  Select-Object -First 1

Write-Output ""
Write-Output "FULL FILE EXPORT ล่าสุด"
Write-Output "Path        : $($fileItem.FullName)"
Write-Output "Updated At  : $($fileItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Output "Size        : $([Math]::Round($fileItem.Length / 1KB, 2)) KB"

if ($generatedLine) {
  Write-Output $generatedLine
}

Write-Output ""
Write-Output "Preview ($PreviewLines lines)"
Write-Output "------------------------------------------------------------"
Get-Content -LiteralPath $exportPath -TotalCount $PreviewLines
