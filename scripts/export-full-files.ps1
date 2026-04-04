param(
  [string]$OutputFile = ".\docs\FULL_FILE_EXPORT.md"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$normalizedOutputFile = $OutputFile -replace '^[.\\\/]+', ''
$outputPath = Join-Path $root $normalizedOutputFile
$outputDir = Split-Path -Parent $outputPath

if (!(Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$files = @(
  "prisma.config.ts",
  "prisma\schema.prisma",
  "prisma\seed.ts",
  "proxy.ts",
  "next.config.ts",
  "instrumentation.ts",
  "package.json",
  ".env.example",
  "README.md",
  "lib\access.ts",
  "lib\attendance-correction.ts",
  "lib\attendance.ts",
  "lib\audit.ts",
  "lib\auth.ts",
  "lib\env.ts",
  "lib\http.ts",
  "lib\observability.ts",
  "lib\payroll.ts",
  "lib\prisma.ts",
  "lib\role.ts",
  "lib\route-guard.ts",
  "lib\subscription.ts",
  "lib\time.ts",
  "lib\validators.ts",
  "app\global-error.tsx",
  "app\globals.css",
  "app\layout.tsx",
  "app\page.tsx",
  "app\providers.tsx",
  "app\api\auth\[...nextauth]\route.ts",
  "app\api\login\route.ts",
  "app\api\me\route.ts",
  "app\api\health\route.ts",
  "app\api\dashboard-summary\route.ts",
  "app\api\employees\route.ts",
  "app\api\employees\[id]\route.ts",
  "app\api\attendance\route.ts",
  "app\api\attendance\check-in\route.ts",
  "app\api\attendance\check-out\route.ts",
  "app\api\attendance\corrections\route.ts",
  "app\api\attendance\corrections\[id]\route.ts",
  "app\api\audit\route.ts",
  "app\api\ops\summary\route.ts",
  "app\api\payroll\run\route.ts",
  "app\login\page.tsx",
  "app\subscription-expired\page.tsx",
  "app\dashboard\page.tsx",
  "app\employees\page.tsx",
  "app\attendance\page.tsx",
  "app\attendance\history\page.tsx",
  "app\attendance\corrections\page.tsx",
  "app\payroll\page.tsx",
  "app\audit\page.tsx",
  "app\ops\page.tsx",
  "types\next-auth.d.ts",
  "scripts\validate-env.mjs",
  "scripts\backup-db.ps1",
  "scripts\restore-db.ps1",
  "docs\LAUNCH_HANDOFF.md"
)

$builder = New-Object System.Text.StringBuilder

[void]$builder.AppendLine("# Full File Export")
[void]$builder.AppendLine()
[void]$builder.AppendLine("สร้างจากเวอร์ชันล่าสุดใน workspace เพื่อใช้ handoff หรือส่งตรวจต่อ")
[void]$builder.AppendLine()
[void]$builder.AppendLine("Generated at: $(Get-Date -Format s)")
[void]$builder.AppendLine()

foreach ($relativePath in $files) {
  $absolutePath = Join-Path $root $relativePath

  if (!(Test-Path $absolutePath)) {
    [void]$builder.AppendLine("## $relativePath")
    [void]$builder.AppendLine()
    [void]$builder.AppendLine('`FILE NOT FOUND`')
    [void]$builder.AppendLine()
    continue
  }

  $extension = [System.IO.Path]::GetExtension($absolutePath).TrimStart('.')
  if ([string]::IsNullOrWhiteSpace($extension)) {
    $extension = "txt"
  }

  $content = Get-Content -LiteralPath $absolutePath -Raw

  [void]$builder.AppendLine("## $relativePath")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine([string]::Concat('```', $extension))
  [void]$builder.AppendLine($content.TrimEnd())
  [void]$builder.AppendLine('```')
  [void]$builder.AppendLine()
}

[System.IO.File]::WriteAllText($outputPath, $builder.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Output "Exported full files to $outputPath"
