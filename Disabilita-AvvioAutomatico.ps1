$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName 'AueronRemote-Center' -ErrorAction SilentlyContinue
if (-not $task) { Write-Output 'Avvio automatico Aueron non presente.'; return }
$expectedScript = Join-Path $PSScriptRoot 'scripts\Start-AtBoot.ps1'
if ($task.Actions.Count -ne 1 -or -not $task.Actions[0].Arguments.Contains($expectedScript)) { throw 'Task omonimo non riconosciuto: nessuna modifica.' }
Disable-ScheduledTask -TaskName 'AueronRemote-Center' | Out-Null
Write-Output 'Avvio automatico Aueron disabilitato. Il centro gia avviato resta in esecuzione.'
