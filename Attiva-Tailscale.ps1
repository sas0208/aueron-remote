$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  & node.exe scripts/activate-tailnet.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Attivazione incompleta. Il messaggio precedente indica il passo mancante.' }
} finally { Pop-Location }
