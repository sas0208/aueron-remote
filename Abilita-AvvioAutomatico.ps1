$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$taskName = 'AueronRemote-Center'
$script = Join-Path $root 'scripts\Start-AtBoot.ps1'
$powershell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $script + '"'
$old = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($old -and ($old.Actions.Count -ne 1 -or $old.Actions[0].Execute -ne $powershell -or $old.Actions[0].Arguments -ne $arguments)) {
  throw 'Esiste un task omonimo con azioni diverse: non viene modificato.'
}
$tail = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
$state = (& $tail status --json) | ConvertFrom-Json
if ($state.BackendState -ne 'Running' -or -not $state.Self.Online) { throw 'Collegare Tailscale prima di abilitare avvio automatico.' }
# Explicit preference only: keep the current connection after Windows logout.
& $tail set --unattended=true
if ($LASTEXITCODE -ne 0) { throw 'Configurazione modalita Tailscale unattended non riuscita.' }
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT15S'
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Avvia il centro Aueron privato dopo la connessione Tailscale. Nessuna finestra interattiva.' -Force | Out-Null
Write-Output 'Avvio automatico AueronRemote-Center abilitato; Tailscale unattended attivo.'
