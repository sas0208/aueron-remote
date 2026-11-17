import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, stat, copyFile, unlink, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
export const quotePS = value => "'" + value.replaceAll("'", "''") + "'";
export function remoteCommand(command, workingDirectory, nonce = randomUUID().replaceAll('-', '')) {
  if (!path.win32.isAbsolute(workingDirectory) || /[\r\n\0]/.test(workingDirectory)) throw Error('Usare una directory Windows assoluta.');
  const inner = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $global:LASTEXITCODE=0; try { Set-Location -LiteralPath ${quotePS(workingDirectory)}; & {\n${command}\n}; $ok=$?; if(-not $ok){exit 1}; exit $global:LASTEXITCODE } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`;
  const encoded = Buffer.from(inner, 'utf16le').toString('base64');
  const marker = `AUERON_EXIT_${nonce}=`;
  return { marker, script: `$ProgressPreference='SilentlyContinue'; & powershell.exe -NoProfile -NonInteractive -OutputFormat Text -EncodedCommand ${encoded}; $aueronExit=$LASTEXITCODE; Write-Output ([Environment]::NewLine+'${marker}'+$aueronExit)` };
}
export function parseCommand(output, marker) {
  const lines = output.split(/\r?\n/);
  const index = lines.findLastIndex(line => line.trim().startsWith(marker));
  if (index < 0 || !/^-?\d+$/.test(lines[index].trim().slice(marker.length))) throw Error('Esecuzione non confermata: codice di uscita remoto assente. Il processo remoto potrebbe essere ancora attivo.');
  const exitCode = Number(lines[index].trim().slice(marker.length));
  lines.splice(index, 1);
  return { confirmed: true, exitCode, output: lines.join('\n').trim() };
}
export function mesh(action, args = [], timeout = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn(ps, ['-NoProfile', '-NonInteractive', '-File', path.join(root, 'Aueron-AI.ps1'), '-RequestStdin'], { cwd: root, windowsHide: true, env:{...process.env,PATHEXT:process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD'}, stdio: ['pipe','pipe','pipe'] });
    let output = '', error = '', failure;
    const timer = setTimeout(() => { failure=Error('Timeout: operazione non confermata; il comando remoto potrebbe proseguire.'); child.kill(); }, timeout);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; if(output.length > 2_000_000) { failure=Error('Output oltre 2 MB: operazione non confermata.'); child.kill(); } });
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-8000); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.stdin.on('error', () => {});
    child.on('close', code => { clearTimeout(timer); if(failure) reject(failure); else if(code !== 0) reject(Error(error.trim() || `Trasporto Aueron fallito (${code}).`)); else resolve(output.replace(/^\uFEFF/, '').trim()); });
    child.stdin.end(JSON.stringify({ action, args }));
  });
}
export async function devices() {
  const data = JSON.parse(await mesh('listdevices'));
  if (!Array.isArray(data)) throw Error('Elenco dispositivi non valido.');
  return data.map(d => ({ id:d._id, name:d.name, online:!!(d.conn & 1), group:d.groupname, os:d.osdesc }));
}
async function requireDevice(id, online = true) {
  const device = (await devices()).find(d => d.id === id);
  if (!device) throw Error('PC non presente fra quelli autorizzati.');
  if (online && !device.online) throw Error('PC offline.');
  return device;
}
export async function run({ nodeId, command, workingDirectory, timeoutSeconds = 120 }) {
  await requireDevice(nodeId);
  const wrapped = remoteCommand(command, workingDirectory);
  const output = await mesh('runcommand', ['--id', nodeId, '--powershell', '--run', wrapped.script], timeoutSeconds * 1000);
  return { nodeId, workingDirectory, ...parseCommand(output, wrapped.marker) };
}
export async function info(nodeId) {
  await requireDevice(nodeId, false);
  return JSON.parse(await mesh('deviceinfo', ['--id', nodeId, '--json']));
}
export async function upload({ nodeId, localFile, remoteDirectory }) {
  if(!path.isAbsolute(localFile)) throw Error('Il file locale deve avere un percorso assoluto.');
  if(!(await stat(localFile)).isFile()) throw Error('Il percorso locale non e un file.');
  const hash=createHash('sha256').update(await readFile(localFile)).digest('hex');
  const remoteFile=path.win32.join(remoteDirectory,path.basename(localFile));
  const check=await run({nodeId,workingDirectory:remoteDirectory,command:`if(Test-Path -LiteralPath ${quotePS(remoteFile)}){throw 'Il file remoto esiste gia: nessuna sovrascrittura.'}`});
  if(check.exitCode !== 0) throw Error(check.output);
  const output=await mesh('upload',['--id',nodeId,'--file',localFile,'--target',remoteDirectory]);
  if(!/Upload done, \d+ bytes sent\./.test(output)) throw Error('Upload non confermato: '+output);
  const verify=await run({nodeId,workingDirectory:remoteDirectory,command:`(Get-FileHash -LiteralPath ${quotePS(remoteFile)} -Algorithm SHA256).Hash`});
  if(verify.exitCode !== 0 || !verify.output.toLowerCase().includes(hash)) throw Error('Upload eseguito ma integrita remota non confermata.');
  return {nodeId,remoteFile,sha256:hash,verified:true};
}
export async function download({ nodeId, remoteFile, localFile }) {
  if(!path.isAbsolute(localFile)) throw Error('La destinazione locale deve avere un percorso assoluto.');
  try { await access(localFile); throw Error('Il file locale esiste gia: nessuna sovrascrittura.'); } catch(e) { if(e.code !== 'ENOENT') throw e; }
  const verify=await run({nodeId,workingDirectory:path.win32.dirname(remoteFile),command:`(Get-FileHash -LiteralPath ${quotePS(remoteFile)} -Algorithm SHA256).Hash`});
  const expected=verify.output.match(/\b[a-fA-F0-9]{64}\b/)?.[0]?.toLowerCase();
  if(verify.exitCode !== 0 || !expected) throw Error('Impossibile verificare il file remoto.');
  const temporary=path.join(path.dirname(localFile),'.aueron-download-'+randomUUID()+'.part');
  try {
    const output=await mesh('download',['--id',nodeId,'--file',remoteFile,'--target',temporary]);
    if(!/Download completed, \d+ bytes written\./.test(output)) throw Error('Download non confermato: '+output);
    const hash=createHash('sha256').update(await readFile(temporary)).digest('hex');
    if(hash !== expected) throw Error('Hash del download diverso dal file remoto.');
    await copyFile(temporary,localFile,constants.COPYFILE_EXCL);
    return {nodeId,localFile,sha256:hash,verified:true};
  } finally { await unlink(temporary).catch(e=>{if(e.code !== 'ENOENT') throw e;}); }
}
