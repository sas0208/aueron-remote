$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Compilatore .NET Framework 4.x non disponibile.' }
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ('/out:' + (Join-Path $root 'AueronRemote.exe')) (Join-Path $root 'app\AueronRemote.cs')
if ($LASTEXITCODE -ne 0) { throw 'Compilazione fallita.' }
$test = Start-Process -FilePath (Join-Path $root 'AueronRemote.exe') -ArgumentList '--self-test' -WindowStyle Hidden -Wait -PassThru
if ($test.ExitCode -ne 0) { throw 'Verifica del client fallita.' }
Write-Output 'AueronRemote.exe compilato; verifiche URL superate.'
