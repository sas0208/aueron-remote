// One-time setup, using an administrator supplied on stdin. Never persists that administrator's password.
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const require = createRequire(join(root, 'node_modules/meshcentral/meshcentral.js'));
const WebSocket = require('ws');
const destination = join(process.env.LOCALAPPDATA, 'AueronRemoteAI/identity.xml');

if (existsSync(destination)) throw new Error('Identita AI gia presente: nessuna credenziale sovrascritta.');
let input = '';
for await (const chunk of process.stdin) { input += chunk; if (input.length > 8192) throw new Error('Input troppo grande.'); }
const administrator = JSON.parse(input);
const expectedAdmin = process.env.AUERON_ADMIN_USER;
if (!expectedAdmin || administrator.username !== expectedAdmin || typeof administrator.password !== 'string') throw new Error('Amministratore non previsto.');
const origin = new URL(readFileSync(join(root, 'runtime/hub-address.txt'), 'utf8').trim());
if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.ts.net')) throw new Error('Centro privato non configurato.');
const headers = { 'x-meshauth': Buffer.from(administrator.username).toString('base64') + ',' + Buffer.from(administrator.password).toString('base64') };
const socket = new WebSocket('wss://' + origin.host + '/control.ashx', { headers, rejectUnauthorized: true });
const pending = new Map();
socket.on('message', buffer => {
  let message; try { message = JSON.parse(buffer.toString()); } catch { return; }
  const waiter = pending.get(message.responseid);
  if (waiter) { clearTimeout(waiter.timer); pending.delete(message.responseid); waiter.resolve(message); }
});
function request(data) {
  return new Promise((resolve, reject) => {
    const responseid = randomUUID();
    const timer = setTimeout(() => { pending.delete(responseid); reject(new Error('Risposta del centro non ricevuta.')); }, 12000);
    pending.set(responseid, { resolve, timer });
    socket.send(JSON.stringify({ ...data, responseid }));
  });
}
function protect(password) {
  const script = `$ErrorActionPreference='Stop'
    $ProgressPreference='SilentlyContinue'
    $data=[Console]::In.ReadToEnd() | ConvertFrom-Json
    $folder=Join-Path $env:LOCALAPPDATA 'AueronRemoteAI'
    $file=Join-Path $folder 'identity.xml'
    if(Test-Path -LiteralPath $file){throw 'Identita gia presente'}
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    $secure=ConvertTo-SecureString $data.password -AsPlainText -Force
    $credential=New-Object System.Management.Automation.PSCredential($data.username,$secure)
    $credential | Export-Clixml -LiteralPath $file
    Write-Output 'Identita protetta con DPAPI per questo utente Windows.'`;
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { input: JSON.stringify({ username: 'aueron-ai', password }), encoding: 'utf8', windowsHide: true, timeout: 15000 });
}
try {
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const password = randomBytes(30).toString('base64url');
  const creation = await request({ action: 'adduser', username: 'aueron-ai', realname: 'Aueron AI', pass: password, siteadmin: 0 });
  if (creation.result !== 'ok') throw new Error('Account AI non creato: ' + String(creation.result || 'risposta inattesa'));
  process.stdout.write(protect(password));
  const rights = 8 | 131072 | 65536 | 2048 | 8192 | 4194304 | 8388608;
  const membership = await request({ action: 'addmeshuser', meshname: 'I miei PC', userids: ['user//aueron-ai'], meshadmin: rights });
  if (membership.result !== 'ok' && membership.result !== 'Added user aueron-ai') throw new Error('Account creato, ma autorizzazione al gruppo non completata: ' + String(membership.result || 'risposta inattesa'));
  console.log(JSON.stringify({ ready: true, identity: 'aueron-ai', group: 'I miei PC', serverAdministrator: false, desktopAccess: false, terminalAndFiles: true }));
} finally { socket.close(); for (const item of pending.values()) clearTimeout(item.timer); }
