$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$markdownPath = Join-Path $projectRoot 'docs\USER_MANUAL.md'
$htmlPath = Join-Path $projectRoot 'docs\USER_MANUAL.print.html'
$pdfPath = Join-Path $projectRoot 'docs\USER_MANUAL.pdf'
$edgeProfilePath = Join-Path $projectRoot '.tmp\edge-pdf-profile'
$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

if (-not (Test-Path -LiteralPath $markdownPath)) {
  throw "Markdown source not found: $markdownPath"
}

if (-not (Test-Path -LiteralPath $edgePath)) {
  throw "Microsoft Edge not found: $edgePath"
}

$markdownContent = Get-Content -LiteralPath $markdownPath -Raw -Encoding UTF8
$convertedHtml = (ConvertFrom-Markdown -InputObject $markdownContent).Html

$documentHtml = @"
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Epayroll User Manual</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #f7f1ea;
      color: #1d160f;
      font-family: "Segoe UI", "Noto Sans Thai", sans-serif;
      line-height: 1.7;
    }

    main {
      width: min(900px, calc(100% - 48px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }

    article {
      background: #fffaf5;
      border: 1px solid rgba(103, 74, 45, 0.14);
      border-radius: 24px;
      padding: 40px;
      box-shadow: 0 16px 44px rgba(94, 67, 39, 0.08);
    }

    h1 {
      margin-top: 0;
      font-size: 2.5rem;
      line-height: 1.1;
    }

    h2 {
      margin-top: 2rem;
      font-size: 1.45rem;
    }

    h3 {
      margin-top: 1.6rem;
      font-size: 1.1rem;
    }

    p,
    li {
      font-size: 0.98rem;
    }

    code {
      background: #f3ebe2;
      border-radius: 8px;
      padding: 2px 8px;
      font-family: "Cascadia Code", monospace;
      font-size: 0.92em;
    }

    ul {
      padding-left: 1.3rem;
    }

    @media print {
      body {
        background: #fff;
      }

      main {
        width: auto;
        margin: 0;
        padding: 0;
      }

      article {
        border: 0;
        border-radius: 0;
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <main>
    <article>
$convertedHtml
    </article>
  </main>
</body>
</html>
"@

Set-Content -LiteralPath $htmlPath -Value $documentHtml -Encoding UTF8

New-Item -ItemType Directory -Force -Path $edgeProfilePath | Out-Null

& $edgePath `
  --headless `
  --disable-gpu `
  --allow-file-access-from-files `
  --run-all-compositor-stages-before-draw `
  --virtual-time-budget=10000 `
  --no-pdf-header-footer `
  --user-data-dir="$edgeProfilePath" `
  --print-to-pdf="$pdfPath" `
  "file:///$($htmlPath.Replace('\', '/'))"

if (-not (Test-Path -LiteralPath $pdfPath)) {
  throw "PDF export failed: $pdfPath"
}

$pdfInfo = Get-Item -LiteralPath $pdfPath

Remove-Item -LiteralPath $htmlPath -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Remove-Item -LiteralPath $edgeProfilePath -Recurse -Force -ErrorAction SilentlyContinue

Write-Output "PDF exported: $($pdfInfo.FullName)"
Write-Output "Size: $($pdfInfo.Length) bytes"
