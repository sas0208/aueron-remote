// Aueron activation: no account creation and no credential access.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { makeConfig, validateTailnetHost } from './configure.mjs';

const root = resolve(import.meta.dirname, '..');
const tailscale = join(process.env.ProgramFiles || 'C:/Program Files', 'Tailscale/tailscale.exe');
const publicPort = 8443;
const configPath = join(root, 'runtime/meshcentral-data/config.json');
const options = { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 };
function ts(args) { return execFileSync(tailscale, args, options).trim(); }
function ps(file) {
  // No captured pipes: Windows background children can keep inherited pipe handles open after PowerShell exits.
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, file), ...(file === 'Avvia-Centro.ps1' ? ['-NoBrowser'] : [])], { ...options, timeout: 90000, stdio: 'ignore' });
}
function saveAddress(url) {
  const profile = join(process.env.LOCALAPPDATA, 'AueronRemote');
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, 'hub.txt'), url);
  writeFileSync(join(root, 'runtime/hub-address.txt'), url);
}
function serveState() { return JSON.parse(ts(['serve', 'status', '--json']) || '{}'); }
function existingOtherServices(state, authority) {
  const copy = structuredClone(state);
  if (copy.TCP) { delete copy.TCP[String(publicPort)]; if (!Object.keys(copy.TCP).length) delete copy.TCP; }
  if (copy.Web) { delete copy.Web[authority]; if (!Object.keys(copy.Web).length) delete copy.Web; }
  return copy;
}
function page(url, localSelfSigned = false) {
  return new Promise((accept, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, { ...(localSelfSigned ? { rejectUnauthorized: false } : {}), timeout: 10000 }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; if (text.length > 1024 * 1024) request.destroy(new Error('Risposta inattesa.')); });
      response.on('end', () => accept({ status: response.statusCode, text }));
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('Timeout del centro.')));
  });
}
function verifyAccountPage(response) {
  if (response.status !== 200 || !response.text.includes('Aueron Remote')) throw new Error('La pagina non corrisponde al centro Aueron previsto.');
  const match = response.text.match(/var newAccount\s*=\s*['"]([^'"]+)['"]/);
  if (!match || match[1] !== 'false') throw new Error('Prima crea personalmente il primo account su https://localhost:8943. Nessuna modifica di rete eseguita.');
}

let addedServe = false;
let replacedConfig = false;
let backupPath;
try {
  const state = JSON.parse(ts(['status', '--json']));
  if (state.BackendState !== 'Running' || !state.Self?.Online) throw new Error('Tailscale non e connesso.');
  const host = validateTailnetHost(state.Self.DNSName);
  const authority = `${host}:${publicPort}`;
  const url = `https://${authority}/`;
  const before = serveState();
  const portState = before.TCP?.[publicPort];
  const handlers = before.Web?.[authority]?.Handlers;
  const isOurPort = portState?.HTTPS === true && handlers?.['/']?.Proxy === 'http://127.0.0.1:8943' && Object.keys(handlers).length === 1;
  if ((portState || handlers) && !isOurPort) throw new Error('La porta privata 8443 e gia assegnata a un altro servizio. Non viene modificata.');
  if (before.AllowFunnel?.[authority]) throw new Error('La porta scelta risulta pubblicata con Funnel. Attivazione privata interrotta.');
  const current = JSON.parse(readFileSync(configPath, 'utf8'));
  // Our generated config has no credentials. Refuse to rewrite extensions supplied later by a user.
  const allowed = makeConfig(current.settings?.tlsOffload ? { mode: 'tailscale', hostname: host, publicPort } : { mode: 'local' });
  if (JSON.stringify(current) !== JSON.stringify(allowed)) throw new Error('La configurazione corrente differisce dal profilo generato. Serve una migrazione mirata, nessun file sovrascritto.');
  if (current.settings?.tlsOffload) {
    verifyAccountPage(await page(url));
    saveAddress(url);
    console.log(JSON.stringify({ ready: true, url, changed: false }));
    process.exit(0);
  }
  verifyAccountPage(await page('https://localhost:8943/', true));
  console.log('Account del centro presente; preparo il collegamento privato.');
  const backupDir = join(root, 'runtime/config-history');
  mkdirSync(backupDir, { recursive: true });
  backupPath = join(backupDir, `config.local-${Date.now()}.json`);
  copyFileSync(configPath, backupPath);
  writeFileSync(join(backupDir, `serve-before-${Date.now()}.json`), JSON.stringify(before, null, 2), { flag: 'wx' });
  if (!isOurPort) {
    ts(['serve', '--bg', `--https=${publicPort}`, 'http://127.0.0.1:8943']);
    addedServe = true;
  }
  ps('Ferma-Centro.ps1');
  writeFileSync(configPath, JSON.stringify(makeConfig({ mode: 'tailscale', hostname: host, publicPort }), null, 2) + '\n');
  replacedConfig = true;
  console.log('Avvio Aueron con HTTPS sulla rete Tailscale.');
  ps('Avvia-Centro.ps1');
  console.log('Centro avviato; verifica del certificato HTTPS e dei servizi esistenti.');
  let healthy;
  for (let attempt = 0; attempt < 6; attempt++) {
    try { healthy = await page(url); verifyAccountPage(healthy); break; }
    catch (error) { if (attempt === 5) throw error; await new Promise(done => setTimeout(done, 1500)); }
  }
  const after = serveState();
  if (JSON.stringify(existingOtherServices(before, authority)) !== JSON.stringify(existingOtherServices(after, authority))) throw new Error('Verificare Serve: un servizio preesistente risulta cambiato.');
  saveAddress(url);
  console.log(JSON.stringify({ ready: true, url, changed: true, otherServicesPreserved: true, tlsVerified: true }));
} catch (error) {
  if (replacedConfig && backupPath && existsSync(backupPath)) {
    try { ps('Ferma-Centro.ps1'); copyFileSync(backupPath, configPath); ps('Avvia-Centro.ps1'); } catch { console.error('Ripristino automatico non completato: verificare il processo Aueron.'); }
  }
  if (addedServe) { try { ts(['serve', `--https=${publicPort}`, 'off']); } catch { console.error('Rimuovere soltanto il mapping Serve 8443 di Aueron se ancora presente.'); } }
  console.error(error.message);
  process.exitCode = 1;
}
