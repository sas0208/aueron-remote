$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$entry = Join-Path $root 'node_modules\meshcentral\meshcentral.js'
$pidPath = Join-Path $root 'runtime\launcher.pid'
if (-not (Test-Path -LiteralPath $pidPath)) { Write-Output 'Nessuna istanza avviata dal launcher.'; return }
$ownedId = [int](Get-Content -LiteralPath $pidPath -Encoding ASCII)
$parent = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $ownedId) -ErrorAction SilentlyContinue
if (-not $parent) { Write-Output 'Istanza gia arrestata.'; return }
if ($parent.Name -ne 'node.exe' -or -not $parent.CommandLine.Contains($entry)) { throw 'Il PID salvato appartiene a un altro processo: arresto rifiutato.' }
$children = @(Get-CimInstance Win32_Process -Filter ('ParentProcessId = ' + $ownedId) | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine.Contains($entry) })
foreach ($process in @($parent) + $children) {
  # CIM also handles a centre started as SYSTEM by Task Scheduler.
  $current = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $process.ProcessId)
  if (-not $current) { continue }
  if ($current.CreationDate -ne $process.CreationDate -or -not $current.CommandLine.Contains($entry)) { throw 'Il processo e cambiato: arresto rifiutato.' }
  $stopped = Invoke-CimMethod -InputObject $current -MethodName Terminate
  if ($stopped.ReturnValue -ne 0) { throw ('Arresto Aueron fallito: ' + $stopped.ReturnValue) }
}
Write-Output 'Arrestata solo la nostra istanza Aueron avviata dal launcher.'
