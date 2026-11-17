param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$server = Join-Path $root 'node_modules\meshcentral\meshcentral.js'
$config = Join-Path $root 'runtime\meshcentral-data\config.json'
if (-not (Test-Path -LiteralPath $server)) { throw 'Dipendenze mancanti. Esegui prima Prepara-Centro.ps1.' }
if (-not (Test-Path -LiteralPath $config)) { throw 'Configurazione mancante. Esegui prima Prepara-Centro.ps1.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$env:NPM_CONFIG_USERCONFIG = Join-Path $root 'npm-public-user.conf'
$env:NPM_CONFIG_GLOBALCONFIG = Join-Path $root 'npm-public-global.conf'
$env:NPM_CONFIG_CACHE = Join-Path $root '.npm-cache'
$busy = Get-NetTCPConnection -State Listen -LocalPort 8943 -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$settings = $serializer.DeserializeObject((Get-Content -LiteralPath $config -Raw -Encoding UTF8))['settings']
$originPort = if ($settings.aliasPort -and [int]$settings.aliasPort -ne 443) { ':' + $settings.aliasPort } else { '' }
$browserUrl = if ($settings.tlsOffload) { 'https://' + $settings.cert + $originPort + '/' } else { 'https://localhost:8943/' }
if ($busy) {
  $owner = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $busy[0].OwningProcess)
  if (-not $owner.CommandLine -or -not $owner.CommandLine.Contains($server)) { throw 'La porta 8943 e occupata da un altro processo. Non lo modifico.' }
  [IO.File]::WriteAllText((Join-Path $root 'runtime\launcher-url.txt'), $browserUrl)
  Write-Output ('AUERON_URL=' + $browserUrl)
  if (-not $NoBrowser) { Start-Process $browserUrl }
  return
}
$logDir = Join-Path $root 'runtime\launcher-logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$launchedPid = & $node (Join-Path $root 'scripts\start-server.mjs')
if ($LASTEXITCODE -ne 0 -or "$launchedPid" -notmatch '^\d+$') { throw 'Avvio del processo Aueron fallito.' }
$proc = Get-Process -Id ([int]$launchedPid) -ErrorAction Stop
$proc.Id | Set-Content -LiteralPath (Join-Path $root 'runtime\launcher.pid') -Encoding ASCII
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Milliseconds 500
  $proc.Refresh()
  if ($proc.HasExited) { throw 'Il centro si e arrestato. Consulta runtime\launcher-logs.' }
  $listener = Get-NetTCPConnection -State Listen -LocalPort 8943 -ErrorAction SilentlyContinue
  if ($listener) {
    $owner = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $listener[0].OwningProcess)
    if ($owner.CommandLine -and $owner.CommandLine.Contains($server) -and (($owner.ProcessId -eq $proc.Id) -or ($owner.ParentProcessId -eq $proc.Id))) { $ready = $true; break }
  }
}
if (-not $ready) { throw 'Avvio ancora in corso. Consulta i log senza avviare altre istanze.' }
[IO.File]::WriteAllText((Join-Path $root 'runtime\launcher-url.txt'), $browserUrl)
Write-Output ('AUERON_URL=' + $browserUrl)
if (-not $NoBrowser) { Start-Process $browserUrl }
