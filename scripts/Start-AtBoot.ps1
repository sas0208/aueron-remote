$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$network = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
$logDirectory = Join-Path $root 'runtime\launcher-logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
try {
  # Wait for the existing network identity; do not log in or change account settings.
  $online = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $state = (& $network status --json 2>$null) | ConvertFrom-Json
      if ($state.BackendState -eq 'Running' -and $state.Self.Online) { $online = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
  }
  if (-not $online) { throw 'Tailscale non ancora connesso; il task riprovera automaticamente.' }
  & (Join-Path $root 'Avvia-Centro.ps1') -NoBrowser
  [IO.File]::AppendAllText((Join-Path $logDirectory 'boot.log'), ([DateTime]::UtcNow.ToString('o') + ' Centro avviato.' + [Environment]::NewLine))
} catch {
  [IO.File]::AppendAllText((Join-Path $logDirectory 'boot.log'), ([DateTime]::UtcNow.ToString('o') + ' Avvio non completato: ' + $_.Exception.Message + [Environment]::NewLine))
  exit 1
}
