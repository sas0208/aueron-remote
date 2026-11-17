param(
  [switch]$RequestStdin,
  [Parameter(Position=0)][string]$Action = 'listdevices',
  [Parameter(ValueFromRemainingArguments=$true)][string[]]$MeshArgs
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $OutputEncoding
[Console]::OutputEncoding = $OutputEncoding
if ($RequestStdin) {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $Action = [string]$request.action
  $MeshArgs = @($request.args)
}
$runner = Join-Path $PSScriptRoot 'scripts\meshctrl-protected.cjs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
if ($Action -eq 'help') {
  & $node $runner $Action @MeshArgs
  exit $LASTEXITCODE
}
$identityPath = Join-Path $env:LOCALAPPDATA 'AueronRemoteAI\identity.xml'
if (-not (Test-Path -LiteralPath $identityPath)) { throw 'Identita AI non configurata per questo utente Windows.' }
# DPAPI decryption occurs inside the application, for this Windows user only.
# No password is placed in argv, source files, logs or the preparation package.
$identity = Import-Clixml -LiteralPath $identityPath
$origin = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'runtime\hub-address.txt')).Trim()
$envelope = @{ url=$origin; username=$identity.UserName; password=$identity.GetNetworkCredential().Password; operation=@{action=$Action;args=@($MeshArgs | Where-Object { $null -ne $_ })} }
try {
  $envelope | ConvertTo-Json -Depth 4 -Compress | & $node $runner --request-stdin
  $result = $LASTEXITCODE
} finally { $envelope.Clear(); $identity = $null }
exit $result
