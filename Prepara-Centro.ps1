$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Push-Location $root
try {
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $nodeVersion = & $node --version
  if ($LASTEXITCODE -ne 0 -or [int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 20) { throw 'Serve Node.js 20 o successivo sul PC che ospita il centro.' }
  & npm.cmd ci --ignore-scripts --no-audit --no-fund --userconfig (Join-Path $root 'npm-public-user.conf') --globalconfig (Join-Path $root 'npm-public-global.conf') --cache (Join-Path $root '.npm-cache')
  if ($LASTEXITCODE -ne 0) { throw 'Installazione delle dipendenze fallita.' }
  & $node scripts/prepare-upstream.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Preparazione della dipendenza Windows fallita.' }
  $config = Join-Path $root 'runtime\meshcentral-data\config.json'
  if (-not (Test-Path -LiteralPath $config)) {
    & $node scripts/configure.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Preparazione della configurazione fallita.' }
  }
  Write-Output 'Centro preparato. Avvia-Centro.ps1 apre solo il servizio locale. Vedi README_IT.md per attivazione e collegamento dei PC.'
} finally { Pop-Location }
